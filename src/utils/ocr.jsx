import Tesseract from "tesseract.js";

export async function extractTextFromImage(file) {
    const {
        data: { text },
    } = await Tesseract.recognize(file, "eng", {
        logger: (m) => console.log(m),
    });

    return text;
}
