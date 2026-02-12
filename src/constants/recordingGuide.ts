// Localized sample texts for voice recording
// Each language has quick (short) and quality (long, multi-paragraph) versions
// Sentences are separated by ` | ` for the UI to split and display one-by-one

export const LOCALIZED_SAMPLE_TEXTS: Record<string, { quick: string[]; quality: string[] }> = {
    English: {
        quick: [
            "Once upon a time, in a deep forest, lived a curious little squirrel.",
            "One day, the squirrel found a sparkling acorn hidden under a golden leaf.",
            "The squirrel decided to go on a grand adventure to find the dream that shines like the stars in the sky.",
            "And so, with a happy heart, the little squirrel set off into the magical forest.",
        ],
        quality: [
            "Once upon a time, in a deep forest, lived a curious little squirrel.",
            "The squirrel's name was Acorn.",
            "Every morning when the warm sunlight shone through the leaves, Acorn would wake up on a big oak tree and look around the beautiful forest.",
            "\"Mom, can I go on an adventure today?\" Acorn asked excitedly.",
            "\"Of course, sweetheart. But make sure to come back before the sun sets!\" The mother squirrel replied with a warm smile.",
            "Acorn skipped through the forest happily!",
            "The sunlight sparkled between the green leaves, and the birds sang cheerful songs.",
            "\"Wow! The world is so big and beautiful!\" Acorn shouted with joy.",
            "After a long and wonderful adventure, Acorn returned home safely.",
            "The mother squirrel hugged Acorn warmly and said, \"Our dear Acorn, you did such a great job today.\"",
            "That night, Acorn had the sweetest dreams under the twinkling starlight.",
            "The end.",
        ],
    },
    Korean: {
        quick: [
            "옛날 옛적, 깊은 숲속에 호기심 많은 작은 다람쥐가 살고 있었어요.",
            "어느 날, 다람쥐는 금빛 나뭇잎 아래 숨겨진 반짝이는 도토리를 발견했어요.",
            "다람쥐는 하늘의 별처럼 빛나는 꿈을 찾아 멋진 모험을 떠나기로 했답니다.",
            "그렇게 작은 다람쥐는 설레는 마음을 안고 신비로운 숲속으로 출발했어요.",
        ],
        quality: [
            "옛날 옛적, 깊은 숲속에 호기심 많은 작은 다람쥐가 살고 있었어요.",
            "다람쥐의 이름은 '도토리'였답니다.",
            "매일 아침 따뜻한 햇살이 나뭇잎 사이로 비추면, 도토리는 커다란 참나무 위에서 일어나 아름다운 숲을 둘러보곤 했어요.",
            "\"엄마, 오늘 모험을 떠나도 돼요?\" 도토리가 신나서 물었어요.",
            "\"그럼, 우리 아기. 하지만 해가 지기 전에 꼭 돌아와야 해!\" 엄마 다람쥐가 따뜻하게 웃으며 대답했어요.",
            "도토리는 숲속을 신나게 뛰어다녔어요!",
            "햇빛이 초록 나뭇잎 사이에서 반짝이고, 새들이 즐거운 노래를 불렀답니다.",
            "\"와! 세상은 정말 크고 아름다워!\" 도토리가 기쁘게 소리쳤어요.",
            "길고 멋진 모험을 마치고, 도토리는 무사히 집으로 돌아왔어요.",
            "엄마 다람쥐는 도토리를 따뜻하게 안아주며 말했어요. \"우리 도토리, 오늘 정말 잘했어.\"",
            "그날 밤, 도토리는 반짝이는 별빛 아래에서 세상에서 가장 달콤한 꿈을 꾸었답니다.",
            "끝.",
        ],
    },
    Japanese: {
        quick: [
            "むかしむかし、深い森の中に、好奇心いっぱいの小さなリスが住んでいました。",
            "ある日、リスは金色の葉っぱの下に隠れたキラキラ光るどんぐりを見つけました。",
            "リスは空の星のように輝く夢を探しに、すてきな冒険に出かけることにしました。",
            "そうして、小さなリスはワクワクしながら不思議な森へと出発しました。",
        ],
        quality: [
            "むかしむかし、深い森の中に、好奇心いっぱいの小さなリスが住んでいました。",
            "リスの名前は「どんぐり」でした。",
            "毎朝、あたたかい日差しが葉っぱの間からさしこむと、どんぐりは大きなカシの木の上で目を覚まし、美しい森を見渡していました。",
            "「ママ、今日は冒険に行ってもいい？」どんぐりはワクワクしながら聞きました。",
            "「もちろんよ。でも、日が暮れる前にかならず帰ってきてね！」お母さんリスはやさしく微笑みながら答えました。",
            "どんぐりは森の中を楽しそうにスキップしました！",
            "木漏れ日が緑の葉っぱの間でキラキラ輝き、鳥たちが楽しい歌を歌っていました。",
            "「わぁ！世界ってこんなに広くて美しいんだ！」どんぐりはうれしそうに叫びました。",
            "長くてすてきな冒険を終えて、どんぐりは無事におうちに帰りました。",
            "お母さんリスはどんぐりをあたたかく抱きしめて言いました。「どんぐり、今日はとってもがんばったね。」",
            "その夜、どんぐりはきらめく星空の下で、世界でいちばん甘い夢を見ました。",
            "おしまい。",
        ],
    },
};

// Backward compat: flat English strings for any legacy usage
export const SAMPLE_TEXTS = {
    quick: LOCALIZED_SAMPLE_TEXTS.English.quick.join(' '),
    quality: LOCALIZED_SAMPLE_TEXTS.English.quality.join('\n'),
};

export const getRecommendedTime = (mode: 'quick' | 'quality'): { min: number; max: number; recommended: number } => {
    if (mode === 'quick') {
        return { min: 20, max: 60, recommended: 30 };
    }
    return { min: 120, max: 300, recommended: 180 };
};
