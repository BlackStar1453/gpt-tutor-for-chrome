import { SavedFile, Translations } from '@/common/internal-services/db'

export interface ChatFileState {
    words: Word[]
    currentFileId: number
    files: SavedFile[]
    categories: string[]
    selectedCategory: string
    selectedWord: Word | null
    selectedWords: { [fileId: number]: Word | null }
}

interface Word {
    idx: number
    text: string
    isNew?: boolean
    lastReviewed?: Date
    nextReview?: Date
    reviewCount?: number
    translations?: Translations
}

function getFromStorage(key: string, defaultValue: unknown) {
    const item = localStorage.getItem(key)
    try {
        return item ? JSON.parse(item) : defaultValue
    } catch (error) {
        console.error('Error parsing JSON from localStorage for key:', key, error)
        return defaultValue // 返回默认值或执行其他错误处理
    }
}

function getFromChromeStorage<T>(key: string, defaultValue: T): Promise<T> {
    return new Promise((resolve) => {
        chrome.storage.local.get(key, (result) => {
            const item = result[key]
            try {
                // 解析并断言为 T 类型
                const parsedItem: T = item ? JSON.parse(item) : defaultValue
                resolve(parsedItem)
            } catch (error) {
                console.error('Error parsing JSON from chrome.storage.local for key:', key, error)
                resolve(defaultValue) // 若出错返回默认值
            }
        })
    })
}

function getNumberFromStorage(key: string, defaultValue: number) {
    const item = localStorage.getItem(key)
    return item ? Number(item) : defaultValue
}

function getObjectFromStorage(key: string, defaultValue: unknown) {
    const item = localStorage.getItem(key)
    return item ? JSON.parse(item) : defaultValue
}

function getObjectFromChromeStorage<T>(key: string, defaultValue: T): Promise<T> {
    return new Promise((resolve) => {
        chrome.storage.local.get(key, (result) => {
            const item = result[key]
            try {
                // 使用类型断言确保返回的是 T 类型
                const parsedItem: T = item ? JSON.parse(item) : defaultValue
                resolve(parsedItem)
            } catch (error) {
                console.error('Error parsing JSON from chrome.storage.local for key:', key, error)
                resolve(defaultValue) // 出错时返回默认值
            }
        })
    })
}

export const getInitialFileState = async (): Promise<ChatFileState> => {
    const currentFileId = getNumberFromStorage('currentFileId', 0)
    const categories = await getFromStorage('categories', ['单词', '表达', '语法', '默认', '学习'])
    const selectedCategory = await getFromStorage('currentCategory', '默认')
    const selectedWord = await getFromChromeStorage('selectedWord', { idx: 1, text: '' })
    const selectedWords = await getObjectFromChromeStorage('selectedWords', {})

    return {
        words: [],
        currentFileId,
        files: [],
        categories,
        selectedCategory,
        selectedWord,
        selectedWords,
    }
}

export const initialFileState: ChatFileState = {
    words: [], // 当前文件的单词
    currentFileId: getNumberFromStorage('currentFileId', 0),
    files: [],
    categories: getFromStorage('categories', ['单词', '表达', '语法', '默认', '学习']),
    selectedCategory: getFromStorage('currentCategory', '默认'),
    selectedWord: { idx: 1, text: '' },
    selectedWords: {}, // 每个文件的选中单词
}
