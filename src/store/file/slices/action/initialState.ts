import { Action } from '@/common/internal-services/db'
export interface ChatActionState {
    actions: Action[]
    selectedAction: Action | null
}

export const initialActionState: ChatActionState = {
    actions: [], // 当前文件的单词
    selectedAction: null,
}