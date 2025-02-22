import { StateCreator } from 'zustand'
import { produce } from 'immer'
import { ChatStore } from '../../store'
import {
    Answers,
    Content,
    SavedFile,
    ActionOutputRenderingFormat,
    FollowUpAnswer,
    Action,
} from '@/common/internal-services/db'
import toast from 'react-hot-toast'
import { ActionGroups } from './initialState'
import { ChatMessage } from '../chat/initialState'
import { addNewNote, isConnected } from '@/common/anki/anki-connect'
import { t } from 'i18next'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const chrome: any

export interface ChatWordAction {
    deleteSelectedWord: () => void
    searchWord: (searchTerm: string) => void
    selectWord: (word: Content) => void
    deleteWords: () => void
    loadWords: (fileId: number, pageNumber: number, pageSize: number) => Promise<boolean>
    addWordToFile: (word: Content, fileName: string) => Promise<{ fileId: number; wordIdx: number } | null | undefined>
    setAnswers: (answers: Answers) => void
    setSelectedGroup: (group: string) => void
    setCurrentWordPositions: (fileId: number, wordIdx: number) => void
    updateWordAnswer: (
        saveKey: string,
        answerText: string,
        answerFormat?: ActionOutputRenderingFormat,
        messageId?: string,
        conversationId?: string,
        fileId?: number,
        wordIdx?: number
    ) => Promise<void>
    updateWordAnswers: (answers: Answers) => void
    updateFollowUpAnswer: (
        fileId: number,
        wordIdx: number,
        index: number,
        followUpAnswerText: string,
        saveKey: string
    ) => Promise<void>
    editSentenceAnswer: (fileId: number, wordIdx: number, index: number, sentenceAnswerText: string) => Promise<void>
    setActionGroups: (actions: Action[]) => void
    updateSelectedWordText: (text: string) => void
    resetInitialState: () => void
    getOrCreateTargetFile: (
        fileName: string,
        selectedGroup: string,
        currentFileId: number | null,
        selectedFiles: SavedFile[],
        files: SavedFile[]
    ) => SavedFile
    addWordToTargetFile: (
        word: Content,
        targetFile: SavedFile,
        currentDate: Date
    ) => Promise<{ fileId: number; wordIdx: number }>
    clearConversationHistory: (saveKey: string) => void
    saveConversationToAnswer: (saveKey: string) => void
    loadConversationFromAnswer: (saveKey: string) => void
    addMessageToHistory: (message: ChatMessage) => void
    addFollowUpMessageToHistory: (message: ChatMessage, followUpIndex: number) => void
    getConversationMessages: () => ChatMessage[]
    updateMessageContent: (messageId: string, content: string) => void
    updateMessageStatus: (messageId: string, status: 'success' | 'error' | 'pending') => void
    addToAnki: (deckname: string, front: string, back: string) => Promise<void>
}

export const chatWord: StateCreator<ChatStore, [['zustand/devtools', never]], [], ChatWordAction> = (set, get) => ({
    async getCompletedWords() {
        try {
            const { currentFileId, files } = get()
            if (!currentFileId) return []
            const allWords = files.find((f) => f.id === currentFileId)?.words
            return allWords?.filter((word) => word.nextReview === null)
        } catch (error) {
            console.error('Failed to get completed words:', error)
            return []
        }
    },

    // 添加到历史记录的文件中
    async addWordToFile(word: Content, fileName: string) {
        try {
            console.log('Starting to add word to History file', word)
            console.log('fileName is', fileName)

            const currentDate = new Date()
            const { selectedGroup, setCurrentWordPositions, selectedFiles, currentFileId, files, selectFile } = get()

            // 第一部分：获取或创建目标文件
            const targetFile = get().getOrCreateTargetFile(fileName, selectedGroup, currentFileId, selectedFiles, files)
            if (!targetFile) {
                throw new Error('Failed to get or create target file')
            }

            // 第二部分：添加单词到目标文件
            const result = await get().addWordToTargetFile(word, targetFile, currentDate)
            if (!result) {
                throw new Error('Failed to add word to target file')
            }

            selectFile(result.fileId)
            console.log('Word added to History file:', { fileId: result.fileId, wordIdx: result.wordIdx })
            setCurrentWordPositions(result.fileId, result.wordIdx)
            return result
        } catch (error) {
            console.error('Failed to add word to History file:', error)
            toast.error('Failed to add word to History file')
            return null
        }
    },

    // 获取或创建目标文件
    getOrCreateTargetFile(
        fileName: string,
        selectedGroup: string,
        currentFileId: number | null,
        selectedFiles: SavedFile[],
        files: SavedFile[]
    ): SavedFile {
        const currentFile = selectedFiles.find((file) => file.id === currentFileId)
        let targetFile = currentFile || selectedFiles.find((file) => file.name === fileName)

        if (!targetFile) {
            targetFile = {
                id: files.length > 0 ? Math.max(...files.map((f) => f.id || 0)) + 1 : 1,
                name: fileName,
                category: selectedGroup,
                words: [],
            }

            set(
                produce((draft) => {
                    draft.files.push(targetFile)
                    draft.selectedFiles.push(targetFile)
                })
            )
        }

        return targetFile
    },

    // 添加单词到目标文件
    addWordToTargetFile(
        word: Content,
        targetFile: SavedFile,
        currentDate: Date
    ): Promise<{ fileId: number; wordIdx: number }> {
        // 获取新单词的 idx
        const getNextIdx = (fileId: number) => {
            const file = get().files.find((f) => f.id === fileId)
            if (!file?.words?.length) return 1
            return Math.max(...file.words.map((w) => w.idx)) + 1
        }

        const nextIdx = targetFile.id ? getNextIdx(targetFile.id) : 1
        const wordCopy: Content = {
            ...word,
            idx: nextIdx,
            inHistory: true,
            lastReviewed: currentDate,
        }

        let addedFileId = 0
        let addedWordIdx = 0

        set(
            produce((draft) => {
                const fileToUpdate = draft.files.find((file: SavedFile) => file.id === targetFile.id)
                if (fileToUpdate) {
                    if (!fileToUpdate.words) {
                        fileToUpdate.words = []
                    }
                    fileToUpdate.words.push(wordCopy)
                    addedFileId = fileToUpdate.id || 0
                    addedWordIdx = wordCopy.idx
                }
                draft.selectedWord = wordCopy
                draft.currentFileId = addedFileId
            })
        )

        return Promise.resolve({ fileId: addedFileId, wordIdx: addedWordIdx })
    },

    loadWords: async (fileId: number, pageNumber: number, pageSize: number) => {
        console.log('fileId is', fileId)
        if (fileId === 0) {
            return false
        }
        const { files } = get()
        try {
            const file = files.find((f) => f.id === fileId)
            if (!file) {
                console.error('File not found')
                return false
            }

            if (file.words.length > 0) {
                set(
                    produce((draft) => {
                        draft.words = file.words
                        draft.currentPage = pageNumber
                        draft.totalPages = Math.ceil(file.words.length / pageSize)
                    })
                )
                return true
            }
            return false // 加载失败
        } catch (error) {
            console.error('Error loading words:', error)
            return false
        }
    },

    setSelectedGroup(category: string) {
        set({ selectedGroup: category, currentFileId: null })
    },

    setCurrentWordPositions: (fileId: number, wordIdx: number) => {
        set(
            produce((draft) => {
                draft.currentWordPositions[fileId] = wordIdx
            })
        )
    },

    searchWord: (searchTerm) => {
        const { words } = get()
        const foundWord = words.find((word) => word.text.includes(searchTerm))
        if (foundWord) {
            get().selectWord(foundWord)
        } else {
            alert('Word not found')
        }
    },
    selectWord: (word: Content | null) => {
        const { currentFileId, setAnswers } = get()

        set(
            produce((draft) => {
                draft.selectedWord = word
                if (currentFileId) {
                    draft.currentWordPositions[currentFileId] = word?.idx
                }
                draft.quoteText = word?.text || ''
                draft.answers = word?.answers || {}
                setAnswers(draft.answers)
            })
        )
    },

    deleteWords: () => {
        set(
            produce((draft) => {
                draft.words = []
            })
        )
    },

    deleteSelectedWord: () => {
        set({ selectedWord: null, answers: {} })
    },

    // 更新单词答案
    updateWordAnswer: async (
        saveKey: string,
        answerText: string,
        answerFormat?: ActionOutputRenderingFormat,
        messageId?: string,
        conversationId?: string
    ) => {
        try {
            const { updateFileWords, currentFileId, selectedWord, selectedGroup, files } = get()
            let fileId = currentFileId
            let wordIdx = selectedWord?.idx
            if (!fileId) {
                const targetFiles = files.filter((f: SavedFile) => f.category === selectedGroup)
                fileId = targetFiles.length + 1
            }
            if (!wordIdx) {
                const targetFile = files.find((f: SavedFile) => f.id === fileId)
                wordIdx = targetFile?.words.length ? targetFile.words.length + 1 : 1
            }
            updateFileWords(fileId, (words) =>
                words.map((word) => {
                    if (word.idx === wordIdx) {
                        return {
                            ...word,
                            messageId,
                            conversationId,
                            answers: {
                                ...word.answers,
                                [saveKey]: {
                                    text: answerText,
                                    format: answerFormat || 'markdown',
                                },
                            },
                        }
                    }
                    return word
                })
            )
        } catch (error) {
            console.error('更新单词答案失败:', error)
            // 这里可以添加错误处理逻辑，如显示错误提示等
        }
    },

    updateWordAnswers: (answers: Answers) => {
        try {
            const { updateFileWords, currentFileId, selectedWord, selectedGroup, files } = get()
            let fileId = currentFileId
            let wordIdx = selectedWord?.idx
            if (!fileId) {
                const targetFiles = files.filter((f: SavedFile) => f.category === selectedGroup)
                fileId = targetFiles.length + 1
            }
            if (!wordIdx) {
                const targetFile = files.find((f: SavedFile) => f.id === fileId)
                wordIdx = targetFile?.words.length ? targetFile.words.length + 1 : 1
            }
            updateFileWords(fileId, (words) =>
                words.map((word) => {
                    if (word.idx === wordIdx) {
                        return {
                            ...word,
                            answers: answers,
                        }
                    }
                    return word
                })
            )
        } catch (error) {
            console.error('更新单词答案失败:', error)
            // 这里可以添加错误处理逻辑，如显示错误提示等
        }
    },

    // 更新content的sentenceAnswers
    editSentenceAnswer: async (fileId: number, wordIdx: number, index: number, sentenceAnswerText: string) => {
        set(
            produce((draft) => {
                const file = draft.files.find((f: SavedFile) => f.id === fileId)
                if (!file) console.error('File not found')

                const word = file.words.find((w: Content) => w.idx === wordIdx) || draft.selectedWord
                if (!word) console.error('Word not found')

                if (!word.sentenceAnswers) {
                    word.sentenceAnswers = []
                }
                const existingAnswerIndex = word.sentenceAnswers.findIndex((a: FollowUpAnswer) => a.idx === index)

                if (existingAnswerIndex !== -1) {
                    // 更新现有答案，只添加新内容
                    const existingAnswer = word.sentenceAnswers[existingAnswerIndex]
                    const newContent = sentenceAnswerText.replace(existingAnswer.text, '').trim()
                    word.sentenceAnswers[existingAnswerIndex] = {
                        ...existingAnswer,
                        text: existingAnswer.text + (newContent ? '\n\n' + newContent : ''),
                        updatedAt: new Date(),
                    }
                    // 更新selectedWord
                    draft.selectedWord = word
                } else {
                    // 添加新答案
                    word.sentenceAnswers.push({
                        idx: index,
                        text: sentenceAnswerText,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    })
                    // 更新selectedWord
                    draft.selectedWord = word
                }
            })
        )
    },

    // 更新content的 followUpAnswer
    updateFollowUpAnswer: async (
        fileId: number,
        wordIdx: number,
        index: number,
        followUpAnswerText: string,
        saveKey: string
    ) => {
        set(
            produce((draft) => {
                const file = draft.files.find((f: SavedFile) => f.id === fileId)
                if (!file) console.error('File not found')

                const word = file.words.find((w: Content) => w.idx === wordIdx) || draft.selectedWord
                if (!word) console.error('Word not found')

                if (!word.answers) {
                    word.answers = {}
                }

                const answer = word.answers[saveKey]
                if (!answer.followUpAnswers) {
                    answer.followUpAnswers = []
                }

                const existingAnswerIndex = answer.followUpAnswers.findIndex((a: FollowUpAnswer) => a.idx === index)

                if (existingAnswerIndex !== -1) {
                    // 更新现有答案
                    const existingAnswer = answer.followUpAnswers[existingAnswerIndex]
                    const newContent = followUpAnswerText.replace(existingAnswer.text, '').trim()
                    answer.followUpAnswers[existingAnswerIndex] = {
                        ...existingAnswer,
                        text: existingAnswer.text + (newContent ? '\n\n' + newContent : ''),
                        updatedAt: new Date(),
                    }
                    // 更新selectedWord
                    draft.selectedWord = word
                } else {
                    // 添加新答案
                    answer.followUpAnswers.push({
                        idx: index,
                        text: followUpAnswerText,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    })
                    // 更新selectedWord
                    draft.selectedWord = word
                }
            })
        )
    },

    setAnswers: async (answers: Answers) => {
        set({ answers })
    },

    setActionGroups: (actions: Action[]) => {
        const groups = actions.reduce((groups: ActionGroups, action) => {
            if (!action.groups) return groups
            action.groups.forEach((group) => {
                if (!groups[group]) groups[group] = []
                groups[group].push(action)
            })
            return groups
        }, {} as ActionGroups)
        console.log('groups', groups)
        set({ actionGroups: groups })
    },

    updateSelectedWordText: (text: string) => {
        const { currentFileId, selectedWord } = get()

        if (!currentFileId || !selectedWord) {
            console.warn('No current file or selected word')
            return
        }

        set(
            produce((draft) => {
                // 更新 files 中的 word
                const file = draft.files.find((f: SavedFile) => f.id === currentFileId)
                if (file) {
                    const word = file.words.find((w: Content) => w.idx === selectedWord.idx)
                    if (word) {
                        word.text = text
                    }
                }

                // 更新 selectedWord
                if (draft.selectedWord) {
                    draft.selectedWord.text = text
                }

                // 更新 quoteText
                draft.quoteText = text
            })
        )
    },

    resetInitialState: () => {
        set(
            produce((draft) => {
                // 重置相关状态
                draft.words = []
                draft.answers = {}
                draft.selectedWord = null
                draft.selectedGroup = 'No Group' // 或其他默认值
                // 其他需要重置的状态...
            })
        )
    },

    addMessageToHistory: (message: ChatMessage) =>
        set(
            produce((draft: ChatStore) => {
                // 确定 saveKey 的优先级：currentConversationKey > activateAction.name > editableText
                const saveKey = draft.currentConversationKey

                console.log('Using saveKey:', saveKey)

                // 创建新消息
                const newMessage = {
                    ...message,
                    createdAt: message.createdAt || Date.now(),
                    messageId: message.messageId || crypto.randomUUID(),
                }

                // 添加新消息到当前会话历史
                draft.conversationHistory.push(newMessage)

                if (draft.selectedWord && saveKey) {
                    // 确保必要的数据结构存在
                    if (!draft.selectedWord.answers) {
                        draft.selectedWord.answers = {}
                    }
                    if (!draft.selectedWord.answers[saveKey]) {
                        draft.selectedWord.answers[saveKey] = {
                            text: '',
                            format: 'text',
                            conversationMessages: [],
                        }
                    }

                    // 获取现有的对话记录
                    const existingMessages = draft.selectedWord.answers[saveKey].conversationMessages || []

                    // 更新答案对象
                    draft.selectedWord.answers[saveKey] = {
                        ...draft.selectedWord.answers[saveKey],
                        conversationMessages: [...existingMessages, newMessage],
                    }

                    // 更新 files 中的 word
                    if (draft.currentFileId) {
                        const fileIndex = draft.files?.findIndex((f) => f.id === draft.currentFileId)
                        if (fileIndex !== -1 && draft.files[fileIndex].words) {
                            const wordIndex = draft.files[fileIndex].words.findIndex(
                                (w) => w.idx === draft.selectedWord?.idx
                            )
                            if (wordIndex !== -1) {
                                draft.files[fileIndex].words[wordIndex] = {
                                    ...draft.files[fileIndex].words[wordIndex],
                                    answers: draft.selectedWord.answers,
                                }
                            }
                        }
                    }
                }
            })
        ),

    addFollowUpMessageToHistory: (message: ChatMessage, followUpIndex: number) =>
        set(
            produce((draft: ChatStore) => {
                const saveKey = draft.currentConversationKey

                // 创建新消息
                const newMessage = {
                    ...message,
                    createdAt: message.createdAt || Date.now(),
                    messageId: message.messageId || crypto.randomUUID(),
                }

                if (draft.selectedWord && saveKey) {
                    // 确保必要的数据结构存在
                    if (!draft.selectedWord.answers) {
                        draft.selectedWord.answers = {}
                    }
                    if (!draft.selectedWord.answers[saveKey]) {
                        draft.selectedWord.answers[saveKey] = {
                            text: '',
                            format: 'markdown',
                            followUpAnswers: [],
                        }
                    }
                    if (!draft.selectedWord.answers[saveKey].followUpAnswers) {
                        draft.selectedWord.answers[saveKey].followUpAnswers = []
                    }

                    // 查找或创建对应的 followUpAnswer
                    const followUpAnswerIndex = draft.selectedWord.answers[saveKey].followUpAnswers.findIndex(
                        (a) => a.idx === followUpIndex
                    )

                    if (followUpAnswerIndex !== -1) {
                        // 如果存在，更新现有的 followUpAnswer
                        const existingMessages =
                            draft.selectedWord.answers[saveKey].followUpAnswers[followUpAnswerIndex]
                                .conversationMessages || []
                        draft.selectedWord.answers[saveKey].followUpAnswers[followUpAnswerIndex] = {
                            ...draft.selectedWord.answers[saveKey].followUpAnswers[followUpAnswerIndex],
                            conversationMessages: [...existingMessages, newMessage],
                            updatedAt: new Date(),
                        }
                    } else {
                        // 如果不存在，创建新的 followUpAnswer
                        draft.selectedWord.answers[saveKey].followUpAnswers.push({
                            idx: followUpIndex,
                            text: '',
                            question: '',
                            createdAt: new Date(),
                            updatedAt: new Date(),
                            conversationMessages: [newMessage],
                        })
                    }

                    // 更新 files 中的 word
                    if (draft.currentFileId) {
                        const fileIndex = draft.files?.findIndex((f) => f.id === draft.currentFileId)
                        if (fileIndex !== -1 && draft.files[fileIndex].words) {
                            const wordIndex = draft.files[fileIndex].words.findIndex(
                                (w) => w.idx === draft.selectedWord?.idx
                            )
                            if (wordIndex !== -1) {
                                draft.files[fileIndex].words[wordIndex] = {
                                    ...draft.files[fileIndex].words[wordIndex],
                                    answers: draft.selectedWord.answers,
                                }
                            }
                        }
                    }
                }
            })
        ),

    clearConversationHistory: () =>
        set(
            produce((draft: ChatStore) => {
                draft.conversationHistory = []
                draft.currentConversationId = ''
            })
        ),

    setCurrentConversationId: (id: string) => set({ currentConversationId: id }),

    getConversationMessages: () => {
        const state = get()
        const saveKey = state.currentConversationKey

        if (state.selectedWord?.answers?.[saveKey]?.conversationMessages) {
            return state.selectedWord.answers[saveKey].conversationMessages
        }

        return []
    },

    saveConversationToAnswer: (saveKey: string) =>
        set(
            produce((draft: ChatStore) => {
                const { selectedWord } = draft
                if (!selectedWord || !saveKey) return

                if (!selectedWord.answers) {
                    selectedWord.answers = {}
                }

                selectedWord.answers[saveKey] = {
                    ...(selectedWord.answers[saveKey] || {}),
                    conversationMessages: draft.conversationHistory,
                }
            })
        ),

    loadConversationFromAnswer: (saveKey: string) =>
        set(
            produce((draft: ChatStore) => {
                const { selectedWord } = draft
                if (!selectedWord || !saveKey) return

                const answer = selectedWord.answers?.[saveKey]
                if (answer?.conversationMessages) {
                    draft.conversationHistory = answer.conversationMessages
                    draft.currentConversationId = answer.conversationId || ''
                } else {
                    draft.conversationHistory = []
                    draft.currentConversationId = ''
                }
            })
        ),

    updateConversation: (saveKey: string, messages: ChatMessage[]) =>
        set(
            produce((draft: ChatStore) => {
                draft.conversationHistory = messages

                // 同时更新 word 的消息
                if (draft.selectedWord) {
                    if (!draft.selectedWord.answers) {
                        draft.selectedWord.answers = {}
                    }
                    draft.selectedWord.answers[saveKey] = {
                        ...(draft.selectedWord.answers[saveKey] || {}),
                        conversationMessages: messages,
                    }
                }
            })
        ),

    updateMessageContent: (messageId: string, content: string) =>
        set((state) => ({
            conversationHistory: state.conversationHistory.map((msg) =>
                msg.messageId === messageId ? { ...msg, content } : msg
            ),
        })),

    updateMessageStatus: (messageId: string, status: 'success' | 'error' | 'pending') =>
        set((state) => ({
            conversationHistory: state.conversationHistory.map((msg) =>
                msg.messageId === messageId ? { ...msg, status } : msg
            ),
        })),

    clearConversation: (saveKey: string) =>
        set(
            produce((draft: ChatStore) => {
                draft.conversationHistory = []
                if (draft.selectedWord?.answers) {
                    draft.selectedWord.answers[saveKey] = {
                        ...(draft.selectedWord.answers[saveKey] || {}),
                        conversationMessages: [],
                    }
                }
            })
        ),

    saveConversationToWord: (saveKey: string) =>
        set(
            produce((draft: ChatStore) => {
                const { selectedWord, conversationHistory } = draft
                if (!selectedWord || !saveKey) return

                // 只保存消息到 messages
                if (!selectedWord.answers) {
                    selectedWord.answers = {}
                }
                selectedWord.answers[saveKey] = {
                    ...(selectedWord.answers[saveKey] || {}),
                    conversationMessages: conversationHistory || [],
                }

                // 更新文件中的 word
                if (draft.currentFileId) {
                    const fileIndex = draft.files.findIndex((f) => f.id === draft.currentFileId)
                    if (fileIndex !== -1) {
                        const wordIndex = draft.files[fileIndex].words.findIndex((w) => w.idx === selectedWord.idx)
                        if (wordIndex !== -1) {
                            draft.files[fileIndex].words[wordIndex] = selectedWord
                        }
                    }
                }
            })
        ),

    loadConversationFromWord: (saveKey: string) =>
        set(
            produce((draft: ChatStore) => {
                const { selectedWord } = draft
                if (!selectedWord || !saveKey) return

                // 从 word 加载消息
                if (selectedWord.answers?.[saveKey]) {
                    draft.conversationHistory = selectedWord.answers[saveKey].conversationMessages || []
                } else {
                    draft.conversationHistory = []
                }
            })
        ),

    addToAnki: async (deckname: string, front: string, back: string) => {
        try {
            const connected = await isConnected()

            if (connected) {
                // 如果存在file，应该使用file的title
                const file = get().files.find((f) => f.id === get().currentFileId)
                if (file) {
                    await addNewNote(file.name, front, back)
                } else {
                    await addNewNote(deckname, front, back)
                }
                toast.success(t('Added to review'))
            } else {
                set({ showAnkiNote: true })
                console.debug('Anki Not connected')
                toast.error(t('Anki Not connected'), { duration: 5000 })
            }
        } catch (error) {
            console.error('Error adding note to Anki:', error)
            toast.error(`Error: ${error}`)
        }
    },
})
