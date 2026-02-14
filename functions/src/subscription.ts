import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { PortOneClient } from './portone';

const db = admin.firestore();
const portOne = new PortOneClient();

const PLANS = {
    'storyteller': {
        name: 'Storyteller Plan',
        amount: 9900,
        currency: 'KRW'
    },
    'forest_guardian': {
        name: 'Forest Guardian Plan',
        amount: 19900,
        currency: 'KRW'
    }
};

/**
 * Validates the billing key and initiates the first payment + schedules the next one.
 */
export const subscribeToPlan = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
    }

    const { billingKey, planId } = data;
    const uid = context.auth.uid;

    if (!PLANS[planId as keyof typeof PLANS]) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid plan ID');
    }

    const plan = PLANS[planId as keyof typeof PLANS];
    const merchantUid = `sub_${uid}_${Date.now()}`;
    const nextMerchantUid = `sub_${uid}_${Date.now() + 1000}`; // For schedule

    try {
        // 1. Make immediate payment
        const paymentResult = await portOne.payWithBillingKey({
            customerUid: billingKey,
            merchantUid: merchantUid,
            amount: plan.amount,
            name: `${plan.name} (Monthly)`,
            buyerName: context.auth.token.name || 'StoryForest User',
            buyerEmail: context.auth.token.email || ''
        });

        // 2. Calculate next billing date (1 month later)
        const nextBillingDate = new Date();
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
        const scheduleAt = Math.floor(nextBillingDate.getTime() / 1000);

        // 3. Schedule next payment
        await portOne.schedulePayment({
            customerUid: billingKey,
            merchantUid: nextMerchantUid,
            scheduleAt: scheduleAt,
            amount: plan.amount,
            name: `${plan.name} (Result of Schedule)`,
            buyerName: context.auth.token.name || '',
            buyerEmail: context.auth.token.email || ''
        });

        // 4. Update User Doc
        await db.collection('users').doc(uid).set({
            subscription: {
                planId: planId,
                status: 'active',
                billingKey: billingKey,
                currentPeriodEnd: admin.firestore.Timestamp.fromDate(nextBillingDate),
                lastMerchantUid: merchantUid,
                lastPaymentId: paymentResult.imp_uid || 'mock_imp_id', // Store transaction ID
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }
        }, { merge: true });

        return { success: true, message: 'Subscription started' };

    } catch (error: any) {
        console.error('Subscription failed:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Payment failed');
    }
});

/**
 * Cancel subscription: Unschedules future payments.
 */
export const cancelSubscription = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
    }

    const uid = context.auth.uid;
    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.data();

    if (!userData?.subscription?.billingKey) {
        throw new functions.https.HttpsError('failed-precondition', 'No active subscription found');
    }

    try {
        // Unschedule using the billing key (customer_uid)
        await portOne.unschedule(userData.subscription.billingKey);

        // Update DB
        await db.collection('users').doc(uid).update({
            'subscription.status': 'canceled',
            'subscription.canceledAt': admin.firestore.FieldValue.serverTimestamp(),
            // Remove billing key to prevent reuse? Or keep until period end? 
            // For safety, let's keep it but mark canceled.
        });

        return { success: true, message: 'Subscription canceled' };

    } catch (error: any) {
        console.error('Cancellation failed:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * Webhook to handle scheduled payment results
 */
export const portOneWebhook = functions.https.onRequest(async (req, res) => {
    const { imp_uid, merchant_uid, status } = req.body;

    // In strict mode, verify IP or signature. 
    // PortOne trusted IPs: 52.78.100.19, 52.78.48.223, 52.78.17.128 (check docs for updates)

    try {
        if (status === 'paid') {
            // Find user by merchant_uid (parse it)
            // Format: sub_{uid}_{timestamp}
            const parts = merchant_uid.split('_');
            if (parts.length < 3 || parts[0] !== 'sub') {
                console.error('Invalid merchant_uid format:', merchant_uid);
                res.status(400).send('Invalid format');
                return;
            }

            const uid = parts[1];
            const userRef = db.collection('users').doc(uid);
            const userDoc = await userRef.get();

            if (!userDoc.exists) {
                console.error('User not found for webhook:', uid);
                res.status(404).send('User not found');
                return;
            }

            const userData = userDoc.data();
            const planId = userData?.subscription?.planId || 'storyteller';
            const plan = PLANS[planId as keyof typeof PLANS] || PLANS['storyteller'];

            // Extend Subscription
            const nextBillingDate = new Date();
            nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
            const scheduleAt = Math.floor(nextBillingDate.getTime() / 1000);
            const nextMerchantUid = `sub_${uid}_${Date.now()}`;

            // Schedule NEXT one
            await portOne.schedulePayment({
                customerUid: userData?.subscription?.billingKey,
                merchantUid: nextMerchantUid,
                scheduleAt: scheduleAt,
                amount: plan.amount,
                name: `${plan.name} (Recurring)`,
            });

            // Update DB
            await userRef.update({
                'subscription.status': 'active',
                'subscription.currentPeriodEnd': admin.firestore.Timestamp.fromDate(nextBillingDate),
                'subscription.lastPaymentId': imp_uid,
                'subscription.updatedAt': admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`Subscription extended for user ${uid}`);
        } else if (status === 'failed') {
            // Handle failure (e.g. insufficient funds)
            // Find user and mark as past_due
            // (Logic similar to above for finding uid)
            const parts = merchant_uid.split('_');
            if (parts.length >= 2) {
                const uid = parts[1];
                await db.collection('users').doc(uid).update({
                    'subscription.status': 'past_due'
                });
            }
        }

        res.status(200).send('ok');
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).send('interface error');
    }
});
