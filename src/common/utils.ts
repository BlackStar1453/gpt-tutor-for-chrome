/* eslint-disable @typescript-eslint/no-explicit-any */
import { createParser } from 'eventsource-parser'
import { IBrowser, ISettings } from './types'
import { Action } from './internal-services/db'
import Browser from 'webextension-polyfill'
import { getEngine } from './engines'
import { IModel } from './engines/interfaces'
declare const chrome: typeof Browser
declare global {
    const GM_info: unknown
}

export const defaultAPIURL = 'https://api.openai.com'
export const defaultAPIURLPath = '/v1/chat/completions'
export const defaultProvider = 'OpenAI'
export const defaultAPIModel = 'gpt-3.5-turbo'
export const defaultchatgptModel = 'text-davinci-002-render-sha'

export const defaultChatGPTAPIAuthSession = 'https://chat.openai.com/api/auth/session'
export const defaultChatGPTWebAPI = 'https://chatgpt.com/backend-api'
export const defaultGeminiAPIURL = 'https://generativelanguage.googleapis.com'
export const defaultChatContext = true
export const defaultAutoTranslate = false
export const isFirstTimeUse = true
export const defaultUserLanguage = 'zh-Hans'
export const defaultLearningLanguage = ['en']
export const defaultYouglishLanguage = 'en'
export const defaultSelectInputElementsText = true
export const defaulti18n = 'en'

export async function getApiKey(): Promise<string> {
    const settings = await getSettings()
    const apiKeys = (settings.apiKeys ?? '').split(',').map((s) => s.trim())
    return apiKeys[Math.floor(Math.random() * apiKeys.length)] ?? ''
}

export async function getFreeApiKey(
    id: string,
    name: string,
    remainQuota: number
): Promise<{ apiKey: string; remainQuota: number; expired_time: number; role: string; isFirstTimeUse: boolean }> {
    try {
        const response = await fetch(`https://gpt-tutor-website-with-stripe.vercel.app/api/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                id,
                name,
                remain_quota: remainQuota,
            }),
        })

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }

        const responseData = await response.json()
        console.log('tokenInfo:', JSON.stringify(responseData))
        return {
            apiKey: responseData.token,
            remainQuota: responseData.remain_quota,
            expired_time: responseData.expired_time,
            role: responseData.role,
            isFirstTimeUse: false,
        }
    } catch (error) {
        console.error('Error fetching API key:', error)
        throw error
    }
}

export async function getAzureApiKey(): Promise<string> {
    const settings = await getSettings()
    const apiKeys = (settings.azureAPIKeys ?? '').split(',').map((s) => s.trim())
    return apiKeys[Math.floor(Math.random() * apiKeys.length)] ?? ''
}

function isTokenExpired() {
    const expiresAt = Number(chrome.storage.local.get('expiresAt'))
    return new Date() >= new Date(expiresAt)
}

function isTokenExists() {
    if (chrome.storage.local.get('accessToken') === null) {
        return false
    } else {
        return true
    }
}

export async function getAccessToken(refresh = false): Promise<string> {
    let resp: Response | null = null
    const controller = new AbortController()
    const signal = controller.signal // 使用 AbortController 获取 signal

    try {
        if (refresh || !isTokenExists() || isTokenExpired()) {
            resp = await fetch(defaultChatGPTAPIAuthSession, { signal: signal })
            if (resp.status !== 200) {
                throw new Error('Failed to fetch ChatGPT Web accessToken.')
            }
            const respJson = await resp.json()
            const apiKey = respJson.accessToken
            const expires = respJson.expires

            // 转换并保存过期时间为时间戳（毫秒）
            const expiresAtTimestamp = new Date(expires).getTime()
            await chrome.storage.local.set({ accessToken: apiKey })
            await chrome.storage.local.set({ expiresAt: expiresAtTimestamp.toString() })

            return apiKey
        } else {
            // Token 未过期，直接从 localStorage 返回
            const result = await chrome.storage.local.get(['accessToken'])
            return result.accessToken || '' // 确保返回类型一致，避免 null
        }
    } catch (error) {
        console.error('Error fetching accessToken:', error)
        throw error // 重新抛出错误，确保错误处理
    }
}

export async function getAccessTokenWithoutLocalStorage(): Promise<string> {
    let resp: Response | null = null
    const controller = new AbortController()
    const signal = controller.signal // 使用 AbortController 获取 signal

    try {
        resp = await fetch(defaultChatGPTAPIAuthSession, { signal: signal })
        if (resp.status !== 200) {
            throw new Error('Failed to fetch ChatGPT Web accessToken.')
        }
        const respJson = await resp.json()
        const apiKey = respJson.accessToken

        return apiKey
    } catch (error) {
        console.error('Error fetching accessToken:', error)
        throw error // 重新抛出错误，确保错误处理
    }
}

// In order to let the type system remind you that all keys have been passed to browser.storage.sync.get(keys)
const settingKeys: Partial<Record<keyof ISettings, number>> = {
    isFirstTimeUse: 1,
    automaticCheckForUpdates: 1,
    apiKeys: 1,
    apiURL: 1,
    apiURLPath: 1,
    apiModel: 1,
    provider: 1,
    chatgptModel: 1,
    azureAPIKeys: 1,
    azureAPIURL: 1,
    azureAPIURLPath: 1,
    azureAPIModel: 1,
    azMaxWords: 1,
    enableMica: 1,
    enableBackgroundBlur: 1,
    miniMaxGroupID: 1,
    miniMaxAPIKey: 1,
    miniMaxAPIModel: 1,
    moonshotAPIKey: 1,
    moonshotAPIModel: 1,
    geminiAPIURL: 1,
    geminiAPIKey: 1,
    geminiAPIModel: 1,
    autoTranslate: 1,
    defaultTranslateMode: 1,
    defaultUserLanguage: 1,
    defaultLearningLanguage: 1,
    inputLanguageLevel: 1,
    outputLanguageLevel: 1,
    userBackground: 1,
    alwaysShowIcons: 1,
    hotkey: 1,
    displayWindowHotkey: 1,
    ocrHotkey: 1,
    writingTargetLanguage: 1,
    writingHotkey: 1,
    writingNewlineHotkey: 1,
    themeType: 1,
    i18n: 1,
    tts: 1,
    restorePreviousPosition: 1,
    runAtStartup: 1,
    selectInputElementsText: 1,
    readSelectedWordsFromInputElementsText: 1,
    disableCollectingStatistics: 1,
    allowUsingClipboardWhenSelectedTextNotAvailable: 1,
    pinned: 1,
    autoCollect: 1,
    hideTheIconInTheDock: 1,
    languageDetectionEngine: 1,
    autoHideWindowWhenOutOfFocus: 1,
    proxy: 1,
    customModelName: 1,
    ollamaAPIURL: 1,
    ollamaAPIModel: 1,
    ollamaCustomModelName: 1,
    groqAPIURL: 1,
    groqAPIURLPath: 1,
    groqAPIModel: 1,
    groqAPIKey: 1,
    groqCustomModelName: 1,
    claudeAPIURL: 1,
    claudeAPIURLPath: 1,
    claudeAPIModel: 1,
    claudeAPIKey: 1,
    claudeCustomModelName: 1,
    kimiRefreshToken: 1,
    kimiAccessToken: 1,
    chatglmAccessToken: 1,
    chatglmRefreshToken: 1,
    deepSeekAPIKey: 1,
    deepSeekAPIModel: 1,
    openRouterAPIKey: 1,
    openRouterAPIModel: 1,
    OneAPIAPIKey: 1,
    OneAPIAPIModel: 1,
    fontSize: 1,
    uiFontSize: 1,
    iconSize: 1,
}

export async function getSettings(): Promise<ISettings> {
    const browser = await getBrowser()
    const items = await browser.storage.sync.get(Object.keys(settingKeys))

    const settings = items as ISettings
    if (!settings.chatgptModel) {
        settings.chatgptModel = defaultchatgptModel // 假设有一个默认模型常量
    }
    if (!settings.apiKeys) {
        settings.apiKeys = ''
    }
    if (!settings.apiURL) {
        settings.apiURL = defaultAPIURL
    }
    if (!settings.apiURLPath) {
        settings.apiURLPath = defaultAPIURLPath
    }
    if (!settings.apiModel) {
        settings.apiModel = defaultAPIModel
    }
    if (!settings.provider) {
        settings.provider = defaultProvider
    }
    if (settings.autoTranslate === undefined || settings.autoTranslate === null) {
        settings.autoTranslate = defaultAutoTranslate
    }
    if (!settings.chatContext === undefined || settings.autoTranslate === null) {
        settings.chatContext = defaultChatContext
    }
    if (!settings.defaultTranslateMode) {
        settings.defaultTranslateMode = 'translate'
    }
    if (!settings.isFirstTimeUse === undefined || settings.isFirstTimeUse === null) {
        settings.isFirstTimeUse = isFirstTimeUse
    }
    if (!settings.defaultLearningLanguage) {
        settings.defaultLearningLanguage = defaultLearningLanguage
    }
    if (!settings.defaultUserLanguage) {
        settings.defaultUserLanguage = defaultUserLanguage
    }
    if (!settings.defaultYouglishLanguage) {
        settings.defaultYouglishLanguage = defaultYouglishLanguage
    }
    if (settings.alwaysShowIcons === undefined || settings.alwaysShowIcons === null) {
        settings.alwaysShowIcons = !isTauri()
    }
    if (!settings.i18n) {
        settings.i18n = defaulti18n
    }
    if (!settings.disableCollectingStatistics) {
        settings.disableCollectingStatistics = false
    }
    if (settings.selectInputElementsText === undefined || settings.selectInputElementsText === null) {
        settings.selectInputElementsText = defaultSelectInputElementsText
    }
    if (!settings.themeType) {
        settings.themeType = 'followTheSystem'
    }
    if (settings.provider === 'Azure') {
        if (!settings.azureAPIKeys) {
            settings.azureAPIKeys = settings.apiKeys
        }
        if (!settings.azureAPIURL) {
            settings.azureAPIURL = settings.apiURL
        }
        if (!settings.azureAPIURLPath) {
            settings.azureAPIURLPath = settings.apiURLPath
        }
        if (!settings.azureAPIModel) {
            settings.azureAPIModel = settings.apiModel
        }
    }
    if (settings.provider === 'ChatGPT') {
        if (!settings.chatgptModel) {
            settings.chatgptModel = settings.apiModel
        }
    }
    if (settings.automaticCheckForUpdates === undefined || settings.automaticCheckForUpdates === null) {
        settings.automaticCheckForUpdates = true
    }
    if (settings.enableBackgroundBlur === undefined || settings.enableBackgroundBlur === null) {
        if (settings.enableMica !== undefined && settings.enableMica !== null) {
            settings.enableBackgroundBlur = settings.enableMica
        } else {
            settings.enableBackgroundBlur = false
        }
    }
    if (!settings.languageDetectionEngine) {
        settings.languageDetectionEngine = 'baidu'
    }
    if (!settings.proxy) {
        settings.proxy = {
            enabled: false,
            protocol: 'HTTP',
            server: '127.0.0.1',
            port: '1080',
            basicAuth: {
                username: '',
                password: '',
            },
            noProxy: 'localhost,127.0.0.1',
        }
    }
    if (!settings.ollamaAPIURL) {
        settings.ollamaAPIURL = 'http://127.0.0.1:11434'
    }
    if (!settings.miniMaxAPIModel) {
        settings.miniMaxAPIModel = 'abab5.5-chat'
    }
    if (!settings.groqAPIURL) {
        settings.groqAPIURL = 'https://api.groq.com'
    }
    if (!settings.groqAPIURLPath) {
        settings.groqAPIURLPath = '/openai/v1/chat/completions'
    }
    if (!settings.claudeAPIURL) {
        settings.claudeAPIURL = 'https://api.anthropic.com'
    }
    if (!settings.claudeAPIURLPath) {
        settings.claudeAPIURLPath = '/v1/messages'
    }
    if (settings.geminiAPIURL === undefined || settings.geminiAPIURL === null) {
        settings.geminiAPIURL = defaultGeminiAPIURL
    }
    if (settings.fontSize === undefined || settings.fontSize === null) {
        settings.fontSize = 15
    }
    if (settings.uiFontSize === undefined || settings.uiFontSize === null) {
        settings.uiFontSize = 12
    }
    if (settings.iconSize === undefined || settings.iconSize === null) {
        settings.iconSize = 15
    }
    if (settings.azMaxWords === undefined || settings.azMaxWords === null) {
        settings.azMaxWords = 1024
    }
    return settings
}

export async function setSettings(settings: Partial<ISettings>) {
    const browser = await getBrowser()
    await browser.storage.sync.set(settings)
}

export async function getBrowser(): Promise<IBrowser> {
    if (isElectron()) {
        return (await import('./polyfills/electron')).electronBrowser
    }
    if (isTauri()) {
        return (await import('./polyfills/tauri')).tauriBrowser
    }
    if (isUserscript()) {
        return (await import('./polyfills/userscript')).userscriptBrowser
    }
    return (await import('webextension-polyfill')).default
}

export const isElectron = () => {
    return navigator.userAgent.indexOf('Electron') >= 0
}

export const isTauri = () => {
    if (typeof window === 'undefined') {
        return false
    }
    return window['__TAURI__' as any] !== undefined
}

export const isDesktopApp = () => {
    return isElectron() || isTauri()
}

export const isBrowserExtensionOptions = () => {
    if (typeof window === 'undefined') {
        return false
    }
    return window['__IS_OT_BROWSER_EXTENSION_OPTIONS__' as any] !== undefined
}

export function getAssetUrl(asset: string) {
    if (isUserscript()) {
        return asset
    }
    return `/assets/${asset}`
}

export const isUserscript = () => {
    return typeof GM_info !== 'undefined'
}

export const isDarkMode = async () => {
    const settings = await getSettings()
    if (settings.themeType === 'followTheSystem') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return settings.themeType === 'dark'
}

export const isFirefox = () => /firefox/i.test(navigator.userAgent)

export const isUsingOpenAIOfficialAPIEndpoint = async () => {
    const settings = await getSettings()
    return settings.provider === defaultProvider && settings.apiURL === defaultAPIURL
}

export const isUsingOpenAIOfficial = async () => {
    const settings = await getSettings()
    return settings.provider === 'ChatGPT' || (await isUsingOpenAIOfficialAPIEndpoint())
}

export async function exportToJson<T extends Action>(filename: string, rows: T[]) {
    if (!rows.length) return
    filename += '.json'
    const jsonFile = JSON.stringify(rows, null, 2) // 格式化 JSON 字符串

    if (isDesktopApp()) {
        const { BaseDirectory, writeTextFile } = await import('@tauri-apps/api/fs')
        try {
            return await writeTextFile(filename, jsonFile, { dir: BaseDirectory.Desktop })
        } catch (e) {
            console.error(e)
        }
    } else {
        const link = document.createElement('a')
        if (link.download !== undefined) {
            link.setAttribute('href', 'data:text/json;charset=utf-8,' + encodeURIComponent(jsonFile))
            link.setAttribute('download', filename)
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
        }
    }
}

export const jsonToActions = async (file: File): Promise<any> => {
    console.log('Starting jsonToActions function')
    try {
        // 读取文件内容
        console.log('Reading file content')
        const fileContent = await file.text()
        console.log('File content:', fileContent)

        // 解析 JSON
        console.log('Parsing JSON data')
        const jsonData = JSON.parse(fileContent)

        // 如果数据包含 actions 属性，返回 actions 数组
        if (jsonData.actions && Array.isArray(jsonData.actions)) {
            return jsonData.actions
        }

        // 如果数据本身就是数组，直接返回
        if (Array.isArray(jsonData)) {
            return jsonData
        }

        throw new Error('Invalid actions format')
    } catch (error) {
        console.log('Error importing actions:', error)
        throw error
    }
}

export async function setUserConfig(value: Record<string, any>) {
    await Browser.storage.local.set(value)
}

interface FetchSSEOptions extends RequestInit {
    onMessage(data: string): void
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError(error: any): void
    onStatusCode?: (statusCode: number) => void
}

export async function fetchSSE(input: string, options: FetchSSEOptions) {
    const { onMessage, onError, onStatusCode, ...fetchOptions } = options

    const resp = await fetch(input, fetchOptions)
    onStatusCode?.(resp.status)
    if (resp.status !== 200) {
        onError(await resp.json())
        return
    }

    const parser = createParser((event) => {
        if (event.type === 'event') {
            onMessage(event.data)
        }
    })
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const reader = resp.body!.getReader()
    try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const { done, value } = await reader.read()
            if (done) {
                break
            }
            const str = new TextDecoder().decode(value)
            parser.feed(str)
        }
    } finally {
        reader.releaseLock()
    }
}

export async function parseSSEResponse(resp: Response, onMessage: (message: string) => void) {
    const parser = createParser((event) => {
        if (event.type === 'event') {
            onMessage(event.data)
        }
    })
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const reader = resp.body!.getReader()
    try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const { done, value } = await reader.read()
            if (done) {
                break
            }
            const str = new TextDecoder().decode(value)
            parser.feed(str)
        }
    } finally {
        reader.releaseLock()
    }
}

export async function getArkoseToken(): Promise<string> {
    const config = await Browser.storage.local.get(['chatgptArkoseReqUrl', 'chatgptArkoseReqForm'])
    const response = await fetch(config.chatgptArkoseReqUrl, {
        method: 'POST',
        body: config.chatgptArkoseReqForm,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Origin': 'https://tcr9i.chat.openai.com',
            'Referer': 'https://tcr9i.chat.openai.com/v2/2.4.4/enforcement.f73f1debe050b423e0e5cd1845b2430a.html',
        },
    })
    const data = await response.json()
    if (!data.token) throw new Error('Failed to get Arkose token.')
    return data.token
}

export async function isNeedWebsocket(accessToken: string) {
    const response = await callBackendAPIWithToken(accessToken, 'GET', '/accounts/check/v4-2023-04-27')
    const isNeedWebsocket = (await response.text()).includes('shared_websocket')
    return isNeedWebsocket
}

export async function callBackendAPIWithToken(token: string, method: string, endpoint: string, body?: any) {
    const response = await fetch(`https://chatgpt.com/backend-api${endpoint}`, {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    })

    if (response.status === 401) {
        // Token might be expired or invalid
        Browser.storage.local.remove('accessToken')
        throw new Error('Token expired or invalid, please try again.')
    }
    return response
}

export async function getModels(): Promise<IModel[]> {
    const settings = await getSettings()
    const engine = getEngine(settings.provider)
    return await engine.listModels(settings.apiKeys)
}
