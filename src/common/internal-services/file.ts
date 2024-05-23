import { v } from '@tauri-apps/api/event-30ea0228'
import { SavedFile, Translations, Word, getLocalDB } from './db'

export class FileService {
    private db = getLocalDB()
    private pageSize = 10

    private async getFileOrThrow(fileId: number): Promise<SavedFile> {
        const file = await this.db.files.get(fileId)
        if (!file) {
            throw new Error(`File with ID ${fileId} not found`)
        }
        return file
    }

    // 添加新文件
    async addFile(name: string, words: Word[], category: string): Promise<number> {
        const fileId = await this.db.files.add({ name, words, category })
        return fileId
    }

    // 更新文件信息
    async updateFile(fileId: number, updatedData: { fileName?: string; words?: Word[] }): Promise<void> {
        await this.db.files.update(fileId, updatedData)
    }

    // 删除文件
    async deleteFile(fileId: number): Promise<void> {
        await this.db.files.delete(fileId)
    }

    // 获取文件详情
    async fetchFileDetailsById(fileId: number): Promise<SavedFile> {
        return this.getFileOrThrow(fileId)
    }

    // 获取所有文件
    async fetchAllFiles(): Promise<SavedFile[]> {
        const files = await this.db.files.toArray()
        return files
    }

    // 获取文件名和类别
    async fetchFilesWithoutWords(): Promise<{ name: string; category: string; id?: number }[]> {
        const files = await this.db.files.toArray()
        return files.map((file) => ({ name: file.name, category: file.category, id: file.id }))
    }

    // 获取文件名和ID（按类别）
    async fetchFilesByCategory(category: string): Promise<SavedFile[]> {
        const files = await this.db.files.where({ category }).toArray()
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return files.map((file) => ({ id: file.id!, name: file.name, category: file.category, words: file.words }))
    }

    // 创建文件
    async createFile(name: string, category: string, words: Word[]): Promise<number> {
        const fileId = await this.db.files.add({ name, words, category })
        return fileId
    }

    async getTotalWordCount(fileId: number): Promise<number> {
        const file = await this.fetchFileDetailsById(fileId)
        return file.words.length
    }

    // 按页获取文件中的单词
    async loadWordsByPage(fileId: number, pageNumber: number): Promise<Word[]> {
        console.log('loadWordsByPage', fileId, pageNumber)
        const start = (pageNumber - 1) * this.pageSize
        const end = start + this.pageSize
        const file = await this.fetchFileDetailsById(fileId)
        return file.words.slice(start, Math.min(end, file.words.length))
    }

    // 按文件Id获取单词
    async loadWordsByFileId(fileId: number): Promise<Word[]> {
        const file = await this.fetchFileDetailsById(fileId)
        return file.words
    }

    // 添加单词到文件中
    async addWordToFile(fileId: number, newWord: Word): Promise<void> {
        const file = await this.getFileOrThrow(fileId)
        file.words.push(newWord)
        await this.updateFile(fileId, { words: file.words })
    }

    // 更新文件中的某个单词
    async updateWordInFile(fileId: number, wordIndex: number, updatedWord: Word): Promise<void> {
        const file = await this.fetchFileDetailsById(fileId)
        file.words[wordIndex] = updatedWord
        await this.updateFile(fileId, { words: file.words })
    }

    // 删除文件中的某个单词
    async deleteWordFromFile(fileId: number, wordIndex: number): Promise<void> {
        const file = await this.fetchFileDetailsById(fileId)
        file.words.splice(wordIndex, 1)
        await this.updateFile(fileId, { words: file.words })
    }

    // 添加翻译到文件中的某个单词
    async addOrUpdateTranslationInWord(
        fileId: number,
        wordIdx: number,
        actionName: string,
        wordText: string,
        text: string,
        format: string,
        messageId?: string,
        conversationId?: string
    ): Promise<void> {
        const file = await this.fetchFileDetailsById(fileId)
        let word = file.words.find((w) => w.idx === wordIdx)

        if (!word) {
            // 使用更安全的方式生成新 idx
            const maxIdx = file.words.reduce((max, w) => Math.max(max, w.idx), 0)
            word = {
                idx: maxIdx + 1,
                text: wordText,
                translations: { [actionName]: { text, format, messageId, conversationId } },
                isNew: true,
            }
            file.words.push(word) // 添加到列表末尾
        } else {
            // 更新现有单词的翻译
            if (!word.translations) {
                word.translations = {}
            }
            word.translations[actionName] = { text, format, messageId, conversationId }
        }

        await this.updateFile(fileId, { words: file.words })
    }

    // 删除单词
    async deleteWord(fileId: number, wordIndex: number): Promise<void> {
        const file = await this.fetchFileDetailsById(fileId)
        file.words.splice(wordIndex, 1)
        await this.updateFile(fileId, { words: file.words })
    }

    // 删除某个单词的某个翻译
    async deleteTranslationFromFile(fileId: number, wordIndex: number, actionName: string): Promise<void> {
        const file = await this.fetchFileDetailsById(fileId)
        const word = file.words[wordIndex]
        if (word.translations && word.translations[actionName]) {
            delete word.translations[actionName]
            await this.updateFile(fileId, { words: file.words })
        }
    }

    // 根据 FileId 和 wordIndex 查找并返回单词的 translations
    async getTranslationsByWordIndex(fileId: number, wordIndex: number): Promise<Translations | undefined> {
        const file = await this.fetchFileDetailsById(fileId)
        if (!file || !file.words) {
            throw new Error('File not found or no words in file')
        }
        const word = file.words[wordIndex] // 使用索引直接访问数组元素
        if (!word) {
            throw new Error('Word not found at the provided index')
        }
        return word.translations || {} // 返回找到的 translations 或空对象
    }

    // 根据上次复习时间和复习次数计算下次复习时间
    getNextReviewDate(lastReviewed: Date, reviewCount: number): Date {
        const intervals = [1, 2, 4, 7, 15] // 间隔天数，可以根据需要进行调整
        const nextInterval = intervals[reviewCount] || 30 // 如果超出初始间隔，设定为每月复习一次
        return new Date(lastReviewed.getTime() + nextInterval * 24 * 60 * 60 * 1000)
    }

    // 将单词标记为已复习
    markWordAsReviewed(word: Word, reviewDate: Date): Word {
        const reviewCount = word.translations ? Object.keys(word.translations).length : 0
        return {
            ...word,
            lastReviewed: reviewDate,
            nextReview: this.getNextReviewDate(reviewDate, reviewCount),
        }
    }

    // 获取需要复习的单词
    getWordsToReview(words: Word[]): Word[] {
        const today = new Date()
        return words.filter((word) => word.nextReview && word.nextReview <= today)
    }
}
export const fileService = new FileService()
