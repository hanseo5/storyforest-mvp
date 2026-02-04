export const UI_TRANSLATIONS: Record<string, Record<string, string>> = {
    English: {
        // App-wide
        app_name: "Storyforest",
        app_tagline: "Where stories come to life",
        loading: "Loading...",
        confirm: "Confirm",
        cancel: "Cancel",
        close: "Close",
        save: "Save",
        delete: "Delete",
        edit: "Edit",
        back: "Back",
        next: "Next",
        done: "Done",
        error: "Error",
        success: "Success",
        no_description: "No description available.",

        // Language Selection
        select_language: "Select Language",
        select_language_subtitle: "Choose your preferred language to begin your journey",
        change_language_hint: "You can change this anytime in your profile settings.",

        // Login
        login_title: "Welcome",
        login_subtitle: "Sign in to continue",
        continue_with_google: "Continue with Google",

        // Home
        make_story: "Make a Story",
        make_story_desc: "Create magic with AI",
        read_story: "Read a Story",
        read_story_desc: "Explore available books",
        continue_editing: "Continue Editing",
        no_drafts: "No saved drafts yet. Create a story and save it to continue later!",
        pages: "pages",
        delete_draft_confirm: "Are you sure you want to delete this draft?",
        draft_not_found: "Draft not found",
        failed_load_draft: "Failed to load draft",
        failed_delete_draft: "Failed to delete draft",

        // Library
        library_title: "Story Library",
        translating_library: "Translating Library...",
        translating: "Translating...",
        open: "Open",
        settings: "Settings",

        // Voice Cloning
        clone_voice: "Clone Voice",
        voice_library: "Voice Library",
        read_with_voice: "Read with your voice",
        before_recording: "Before Recording",
        tips_for_cloning: "Tips for a more realistic voice",
        quick_record: "Quick Record",
        high_quality: "High Quality",
        record_quiet_place: "Record in a quiet place",
        keep_20cm: "Keep 20cm from the mic",
        read_clearly: "Read clearly at a natural pace",
        earphones_better: "Earphones/headsets are better",
        recommended_time: "Recommended Time",
        start_recording: "Start Recording",
        please_read_below: "PLEASE READ THE TEXT BELOW:",
        recording: "Recording",
        preview: "Preview",
        pause: "Pause",
        re_record: "Re-record",
        create_audiobook: "Create Audiobook",
        min_recording_required: "Record at least {time}",
        processing: "Processing...",
        processing_warning: "Please do not close this window. It takes 1-2 minutes depending on the book length.",
        ready: "Ready!",
        voice_analysis_complete: "Voice analysis complete.",
        background_generation: "The audiobook will be generated in the background.",

        // Language Change Modal
        language_changed: "Language Changed!",
        language_changed_desc: "To maintain the best story quality, we recommend **cloning your voice again** in the new language ({lang}).",
        clone_voice_now: "Clone Voice Now",
        ill_do_it_later: "I'll do it later",

        // Book Reader
        return_to_library: "Return to Library",
        page_of: "Page {current} of {total}",

        // Book Detail Modal
        read_story_btn: "Read Story",
        preparing_story: "Preparing Story...",
        listen: "Listen",
        record: "Record",

        // Audio Preload Screen
        preparing_audiobooks: "Preparing Audiobooks",
        generating_audio: "Generating Audio",

        // Background Music
        bgm_on: "Background Music On",
        bgm_off: "Background Music Off",

        // Create Story Page
        step: "Step",
        whose_story: "Who is this story for?",
        child_name: "Child's Name",
        name_placeholder: "e.g. Emma, Liam, Mia...",
        age: "Age",
        years_old: "years old",
        what_likes: "What does {name} like?",
        select_up_to_3: "Select up to 3",
        what_to_say: "What would you like to say to {name}?",
        previous: "Previous",
        next_step: "Next",
        create_magic_story: "Create Magic Story ✨",
        story_with: "with",
        go_home: "Go Home",
        my_books: "My Books",
        write_directly: "Write Myself",

        // Interests
        interest_dinosaur: "Dinosaur",
        interest_car: "Car",
        interest_space: "Space",
        interest_animal: "Animal",
        interest_princess: "Princess",
        interest_superhero: "Superhero",
        interest_robot: "Robot",
        interest_ocean: "Ocean",
        interest_fairy: "Fairy",
        interest_dragon: "Dragon",
        interest_train: "Train",
        interest_food: "Food",

        // Messages
        msg_sleep: "Time to sleep early",
        msg_eat: "Don't be a picky eater",
        msg_brave: "Be brave",
        msg_love: "I love you",
        msg_friend: "Be kind to friends",
        msg_clean: "Keep things tidy",
        msg_share: "Learn to share",
        msg_custom: "Custom message",
        custom_placeholder: "e.g. You did well today...",

        // Owl Guide Messages
        owl_msg_1: "Hi! Who shall we write a story for today? ✨",
        owl_msg_2: "Great! What do they like? 🌟",
        owl_msg_3: "Finally, choose the message you want in the story! 💫",

        // Home Page Mascot Messages
        owl_home_1: "✨ What story shall we create?",
        owl_home_2: "📖 Let's write a fairy tale with magic!",
        owl_home_3: "🌟 Come adventure into the storyworld with me!",
        squirrel_home_1: "📚 What book shall we read today?",
        squirrel_home_2: "🎧 I'll read the story to you!",
        squirrel_home_3: "⭐ Let's go to the magic bookshelf!",

        // Library Page
        squirrel_lib_1: "📚 Welcome! What book shall we read?",
        squirrel_lib_2: "✨ What adventure shall we have today?",
        squirrel_lib_3: "🎧 I'll read the story for you!",
        squirrel_lib_4: "⭐ Pick a magical book!",
        story_bookshelf: "Story Bookshelf",
        fetching_books: "Fetching books...",
        no_books_yet: "No books yet 📚",
        make_first_book: "Make Your First Book",
        read_label: "Read",
        audio_preparing: "Preparing audio... (background)",
        translating_books: "Translating...",

        // Home buttons
        create_btn: "Create Story →",
        read_btn: "Go Read Books →",
        footer_tagline: "🌲 STORYFOREST — Fairy Tale Shop 🌲",
    },
    Korean: {
        // App-wide
        app_name: "스토리포레스트",
        app_tagline: "이야기가 살아 숨쉬는 곳",
        loading: "로딩 중...",
        confirm: "확인",
        cancel: "취소",
        close: "닫기",
        save: "저장",
        delete: "삭제",
        edit: "편집",
        back: "뒤로",
        next: "다음",
        done: "완료",
        error: "오류",
        success: "성공",
        no_description: "설명이 없습니다.",

        // Language Selection
        select_language: "언어 선택",
        select_language_subtitle: "여정을 시작할 언어를 선택하세요",
        change_language_hint: "언제든지 설정에서 변경할 수 있습니다.",

        // Login
        login_title: "환영합니다",
        login_subtitle: "계속하려면 로그인하세요",
        continue_with_google: "Google로 계속하기",

        // Home
        make_story: "이야기 만들기",
        make_story_desc: "AI로 마법을 만드세요",
        read_story: "이야기 읽기",
        read_story_desc: "동화책을 탐험하세요",
        continue_editing: "계속 편집하기",
        no_drafts: "아직 저장된 초안이 없습니다. 이야기를 만들고 저장해보세요!",
        pages: "페이지",
        delete_draft_confirm: "이 초안을 삭제하시겠습니까?",
        draft_not_found: "초안을 찾을 수 없습니다",
        failed_load_draft: "초안을 불러오지 못했습니다",
        failed_delete_draft: "초안을 삭제하지 못했습니다",

        // Library
        library_title: "동화 도서관",
        translating_library: "도서관 번역 중...",
        translating: "번역 중...",
        open: "열기",
        settings: "설정",

        // Voice Cloning
        clone_voice: "목소리 복제",
        voice_library: "목소리 보관함",
        read_with_voice: "내 목소리로 읽기",
        before_recording: "녹음 전 확인사항",
        tips_for_cloning: "더 자연스러운 목소리를 위한 팁",
        quick_record: "빠른 녹음",
        high_quality: "고품질 녹음",
        record_quiet_place: "조용한 곳에서 녹음하세요",
        keep_20cm: "마이크와 20cm 거리를 두세요",
        read_clearly: "자연스러운 속도로 또박또박 읽으세요",
        earphones_better: "이어폰/헤드셋 사용을 권장합니다",
        recommended_time: "추천 녹음 시간",
        start_recording: "녹음 시작",
        please_read_below: "아래 텍스트를 읽어주세요:",
        recording: "녹음 중",
        preview: "미리듣기",
        pause: "일시정지",
        re_record: "다시 녹음",
        create_audiobook: "오디오북 만들기",
        min_recording_required: "최소 {time} 이상 녹음해야 합니다",
        processing: "처리 중...",
        processing_warning: "이 창을 닫지 마세요. 책 길이에 따라 1~2분 정도 소요됩니다.",
        ready: "준비 완료!",
        voice_analysis_complete: "목소리 분석이 완료되었습니다.",
        background_generation: "오디오북이 백그라운드에서 생성됩니다.",

        // Language Change Modal
        language_changed: "언어가 변경되었습니다!",
        language_changed_desc: "최상의 품질을 위해 새로운 언어({lang})로 **음성을 다시 복제**하는 것을 권장합니다.",
        clone_voice_now: "지금 목소리 복제하기",
        ill_do_it_later: "나중에 하기",

        // Book Reader
        return_to_library: "도서관으로 돌아가기",
        page_of: "{total}페이지 중 {current}페이지",

        // Book Detail Modal
        read_story_btn: "읽기",
        preparing_story: "준비 중...",
        listen: "듣기",
        record: "녹음",

        // Audio Preload Screen
        preparing_audiobooks: "오디오북 준비 중",
        generating_audio: "오디오 생성 중",

        // Background Music
        bgm_on: "배경음악 켜짐",
        bgm_off: "배경음악 꺼짐",

        // Create Story Page
        step: "단계",
        whose_story: "누구의 이야기인가요?",
        child_name: "아이 이름",
        name_placeholder: "예: 민준, 서윤, 지우...",
        age: "나이",
        years_old: "살",
        what_likes: "{name}이(가) 좋아하는 것은?",
        select_up_to_3: "최대 3개까지 선택하세요 ✨",
        what_to_say: "{name}에게 하고 싶은 말은?",
        previous: "이전",
        next_step: "다음",
        create_magic_story: "마법 동화 만들기 ✨",
        story_with: "와 함께하는 이야기",
        go_home: "홈으로",
        my_books: "내 책",
        write_directly: "직접 쓰기",

        // Interests
        interest_dinosaur: "공룡",
        interest_car: "자동차",
        interest_space: "우주",
        interest_animal: "동물",
        interest_princess: "공주",
        interest_superhero: "슈퍼히어로",
        interest_robot: "로봇",
        interest_ocean: "바다",
        interest_fairy: "요정",
        interest_dragon: "용",
        interest_train: "기차",
        interest_food: "음식",

        // Messages
        msg_sleep: "오늘은 일찍 자자",
        msg_eat: "편식하지 말자",
        msg_brave: "용기를 내자",
        msg_love: "사랑해",
        msg_friend: "친구와 사이좋게",
        msg_clean: "정리정돈 잘하자",
        msg_share: "나눠 쓰자",
        msg_custom: "직접 입력",
        custom_placeholder: "예: 오늘 하루도 수고했어...",

        // Owl Guide Messages
        owl_msg_1: "안녕! 오늘은 누구를 위한 이야기를 쓸까요? ✨",
        owl_msg_2: "좋아요! 그럼 어떤 것들을 좋아하나요? 🌟",
        owl_msg_3: "마지막으로 이야기에 담고 싶은 메시지를 골라주세요! 💫",

        // Home Page Mascot Messages
        owl_home_1: "✨ 어떤 이야기를 만들어 볼까요?",
        owl_home_2: "📖 마법의 깃펜으로 동화를 써요!",
        owl_home_3: "🌟 나와 함께 동화 세계로 떠나요!",
        squirrel_home_1: "📚 오늘은 어떤 책을 읽을까요?",
        squirrel_home_2: "🎧 제가 동화를 읽어드릴게요!",
        squirrel_home_3: "⭐ 마법의 책장으로 가요!",

        // Library Page
        squirrel_lib_1: "📚 어서와요! 어떤 책을 읽어볼까요?",
        squirrel_lib_2: "✨ 오늘은 어떤 모험을 할까요?",
        squirrel_lib_3: "🎧 제가 이야기를 읽어줄게요!",
        squirrel_lib_4: "⭐ 마법의 책을 골라보세요!",
        story_bookshelf: "동화 책장",
        fetching_books: "책을 가져오는 중...",
        no_books_yet: "아직 책이 없어요 📚",
        make_first_book: "첫 번째 책 만들기",
        read_label: "읽기",
        audio_preparing: "오디오 준비 중... (백그라운드)",
        translating_books: "번역 중...",

        // Home buttons
        create_btn: "동화 만들기 →",
        read_btn: "책 읽으러 가기 →",
        footer_tagline: "🌲 STORYFOREST - 동화책방 🌲",
    },
    Japanese: {
        // App-wide
        app_name: "ストーリーフォレスト",
        app_tagline: "物語が息づく場所",
        loading: "読み込み中...",
        confirm: "確認",
        cancel: "キャンセル",
        close: "閉じる",
        save: "保存",
        delete: "削除",
        edit: "編集",
        back: "戻る",
        next: "次へ",
        done: "完了",
        error: "エラー",
        success: "成功",
        no_description: "説明がありません。",

        // Language Selection
        select_language: "言語を選択",
        select_language_subtitle: "旅を始める言語を選んでください",
        change_language_hint: "いつでもプロフィール設定から変更できます。",

        // Login
        login_title: "ようこそ",
        login_subtitle: "続行するにはサインインしてください",
        continue_with_google: "Googleで続行",

        // Home
        make_story: "物語を作る",
        make_story_desc: "AIで魔法を作ろう",
        read_story: "物語を読む",
        read_story_desc: "利用可能な本を探索",
        continue_editing: "編集を続ける",
        no_drafts: "まだ保存された下書きはありません。物語を作って保存しましょう！",
        pages: "ページ",
        delete_draft_confirm: "この下書きを削除してもよろしいですか？",
        draft_not_found: "下書きが見つかりません",
        failed_load_draft: "下書きの読み込みに失敗しました",
        failed_delete_draft: "下書きの削除に失敗しました",

        // Library
        library_title: "ストーリーライブラリ",
        translating_library: "ライブラリを翻訳中...",
        translating: "翻訳中...",
        open: "開く",
        settings: "設定",

        // Voice Cloning
        clone_voice: "声を複製",
        voice_library: "ボイスライブラリ",
        read_with_voice: "自分の声で読む",
        before_recording: "録音の前に",
        tips_for_cloning: "より自然な声のためのヒント",
        quick_record: "クイック録音",
        high_quality: "高音質録音",
        record_quiet_place: "静かな場所で録音してください",
        keep_20cm: "マイクから20cm離してください",
        read_clearly: "自然なペースで、はっきりと読んでください",
        earphones_better: "イヤホン/ヘッドセットの使用をお勧めします",
        recommended_time: "推奨録音時間",
        start_recording: "録音開始",
        please_read_below: "以下のテキストを読んでください：",
        recording: "録音中",
        preview: "プレビュー",
        pause: "一時停止",
        re_record: "録り直し",
        create_audiobook: "オーディオブックを作成",
        min_recording_required: "最低 {time} 以上の録音が必要です",
        processing: "処理中...",
        processing_warning: "このウィンドウを閉じないでください。本の長さによっては1〜2分かかります。",
        ready: "完了！",
        voice_analysis_complete: "音声分析が完了しました。",
        background_generation: "オーディオブックはバックグラウンドで生成されます。",

        // Language Change Modal
        language_changed: "言語が変更されました！",
        language_changed_desc: "最高の品質を維持するために、新しい言語（{lang}）で**声を再複製**することをお勧めします。",
        clone_voice_now: "今すぐ声を複製する",
        ill_do_it_later: "後で",

        // Book Reader
        return_to_library: "ライブラリに戻る",
        page_of: "{total}ページ中 {current}ページ",

        // Book Detail Modal
        read_story_btn: "読む",
        preparing_story: "準備中...",
        listen: "聴く",
        record: "録音",

        // Audio Preload Screen
        preparing_audiobooks: "オーディオブックを準備中",
        generating_audio: "オーディオを生成中",

        // Background Music
        bgm_on: "BGMオン",
        bgm_off: "BGMオフ",

        // Create Story Page
        step: "ステップ",
        whose_story: "誰のための物語ですか？",
        child_name: "お子様の名前",
        name_placeholder: "例: はるき、さくら、ゆうと...",
        age: "年齢",
        years_old: "歳",
        what_likes: "{name}が好きなものは？",
        select_up_to_3: "最大3つまで選べます ✨",
        what_to_say: "{name}に伝えたいことは？",
        previous: "前へ",
        next_step: "次へ",
        create_magic_story: "魔法の物語を作る ✨",
        story_with: "と一緒の物語",
        go_home: "ホームへ",
        my_books: "マイブック",
        write_directly: "自分で書く",

        // Interests
        interest_dinosaur: "恐竜",
        interest_car: "車",
        interest_space: "宇宙",
        interest_animal: "動物",
        interest_princess: "お姫様",
        interest_superhero: "スーパーヒーロー",
        interest_robot: "ロボット",
        interest_ocean: "海",
        interest_fairy: "妖精",
        interest_dragon: "ドラゴン",
        interest_train: "電車",
        interest_food: "食べ物",

        // Messages
        msg_sleep: "今日は早く寝よう",
        msg_eat: "好き嫌いしないで",
        msg_brave: "勇気を出そう",
        msg_love: "大好きだよ",
        msg_friend: "友達と仲良く",
        msg_clean: "整理整頓しよう",
        msg_share: "分け合おう",
        msg_custom: "自分で入力",
        custom_placeholder: "例: 今日も頑張ったね...",

        // Owl Guide Messages
        owl_msg_1: "こんにちは！今日は誰のために物語を書きましょうか？ ✨",
        owl_msg_2: "いいですね！何が好きですか？ 🌟",
        owl_msg_3: "最後に、物語に込めたいメッセージを選んでください！ 💫",

        // Home Page Mascot Messages
        owl_home_1: "✨ どんな物語を作りましょうか？",
        owl_home_2: "📖 魔法のペンで童話を書こう！",
        owl_home_3: "🌟 一緒に物語の世界へ冒険しよう！",
        squirrel_home_1: "📚 今日はどの本を読みましょうか？",
        squirrel_home_2: "🎧 物語を読んであげるよ！",
        squirrel_home_3: "⭐ 魔法の本棚へ行こう！",

        // Library Page
        squirrel_lib_1: "📚 ようこそ！どの本を読みましょうか？",
        squirrel_lib_2: "✨ 今日はどんな冒険をしましょうか？",
        squirrel_lib_3: "🎧 物語を読んであげるよ！",
        squirrel_lib_4: "⭐ 魔法の本を選んでね！",
        story_bookshelf: "物語の本棚",
        fetching_books: "本を取得中...",
        no_books_yet: "まだ本がありません 📚",
        make_first_book: "最初の本を作る",
        read_label: "読む",
        audio_preparing: "オーディオ準備中... (バックグラウンド)",
        translating_books: "翻訳中...",

        // Home buttons
        create_btn: "物語を作る →",
        read_btn: "本を読みに行く →",
        footer_tagline: "🌲 STORYFOREST — 童話書房 🌲",
    },
};
