// Admin / Storyforest official content configuration
// Books created by admin accounts are treated as official Storyforest content
// and shown to ALL users in the "동화책방" (Bookstore) tab.

export const ADMIN_EMAILS = [
    'hsl020819@gmail.com',
];

export const isAdminUser = (email: string | null | undefined): boolean => {
    if (!email) return false;
    return ADMIN_EMAILS.includes(email.toLowerCase());
};
