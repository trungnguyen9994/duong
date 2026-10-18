export const adventureTypes = [
  "forest_rescue",
  "boat_rescue",
  "football",
] as const;
export type AdventureType = (typeof adventureTypes)[number];
export const adventureConfig = {
  forest_rescue: {
    name: "Giải cứu rừng xanh",
    max: 4,
    oral: true,
    choices: 0,
    background: "/art/forest-rescue/image3.jpg",
    objects: [
      "/art/forest-rescue/image13.png",
      "/art/forest-rescue/image14.png",
      "/art/forest-rescue/image15.png",
      "/art/forest-rescue/image16.png",
    ],
    labels: ["Hổ con", "Voi con", "Gấu", "Hươu"],
    instructions:
      "Chọn con vật cần giải cứu. Trả lời câu hỏi, hiện đáp án rồi mở lồng khi trả lời đúng.",
  },
  boat_rescue: {
    name: "Đưa thuyền vào bờ tránh bão",
    max: 5,
    oral: false,
    choices: 3,
    background: "",
    objects: [
      "/art/boat_rescue/image4.png",
      "/art/boat_rescue/image5.png",
      "/art/boat_rescue/image6.png",
      "/art/boat_rescue/image7.png",
      "/art/boat_rescue/image8.png",
    ],
    labels: ["Thuyền 1", "Thuyền 2", "Thuyền 3", "Thuyền 4", "Thuyền 5"],
    instructions:
      "Chọn một thuyền và trả lời câu hỏi. Trả lời đúng để đưa thuyền vào bờ an toàn, sai có thể thử lại.",
  },
  football: {
    name: "Đá bóng tri thức",
    max: 12,
    oral: false,
    choices: 4,
    background: "/art/football/image1.png",
    objects: ["/art/football/image3.png"],
    labels: ["Cú sút"],
    instructions:
      "Chọn một trong bốn đáp án. Trả lời đúng để sút bóng vào cầu môn, sai bóng đi ra ngoài. Thử lại hoặc sang câu tiếp theo.",
  },
} as const;
export const isAdventure = (kind: string): kind is AdventureType =>
  (adventureTypes as readonly string[]).includes(kind);
