import icon from '../assets/images/icon.png'
import { FiEdit } from 'react-icons/fi'
import { createUseStyles } from 'react-jss'
import { IThemedStyleProps } from '../types'
import { useTheme } from '../hooks/useTheme'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { Button } from 'baseui-sd/button'
import { List, arrayMove } from 'baseui-sd/dnd-list'
import { RiDeleteBinLine } from 'react-icons/ri'
import { createElement, useReducer, useRef, useState } from 'react'
import * as mdIcons from 'react-icons/md'
import { Action } from '../internal-services/db'
import { Modal, ModalBody, ModalButton, ModalFooter, ModalHeader } from 'baseui-sd/modal'
import { ActionForm } from './ActionForm'
import { IconType } from 'react-icons'
import { isDesktopApp, exportToJson, jsonToActions } from '../utils'
import { MdArrowDownward, MdArrowUpward } from 'react-icons/md'
import { KIND, Tag } from 'baseui-sd/tag'
import { useStyletron } from 'styletron-react'
import ActionStore from './ActionStore'
import { useChatStore } from '@/store/file/store'

export const useStyles = createUseStyles({
    root: () => ({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isDesktopApp() ? '40px 20px 20px 20px' : 0,
        boxSizing: 'border-box',
        width: isDesktopApp() ? '100%' : 'auto', // 当是桌面应用时占满容器，否则自适应内容
        minWidth: '300px', // 最小宽度设置为300px
        maxWidth: '600px', // 最大宽度设置为600px
    }),
    header: (props: IThemedStyleProps) => ({
        width: '100%',
        color: props.theme.colors.contentPrimary,
        padding: isDesktopApp() ? '40px 20px 20px 20px' : 20,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        position: isDesktopApp() ? 'fixed' : 'block',
        backdropFilter: 'blur(10px)',
        zIndex: 1,
        left: 0,
        top: 0,
        background: props.themeType === 'dark' ? 'rgba(31, 31, 31, 0.5)' : 'rgba(255, 255, 255, 0.5)',
        flexFlow: 'row nowrap',
        cursor: 'move',
        borderBottom: `1px solid ${props.theme.colors.borderTransparent}`,
    }),
    iconContainer: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexShrink: 0,
        marginRight: 'auto',
    },
    icon: {
        'display': 'block',
        'width': '16px',
        'height': '16px',
        '-ms-user-select': 'none',
        '-webkit-user-select': 'none',
        'user-select': 'none',
    },
    iconText: (props: IThemedStyleProps) => ({
        'color': props.themeType === 'dark' ? props.theme.colors.contentSecondary : props.theme.colors.contentPrimary,
        'fontSize': '14px',
        'fontWeight': 600,
        'cursor': 'unset',
        '@media screen and (max-width: 570px)': {
            display: props.isDesktopApp ? 'none' : undefined,
        },
    }),
    operationList: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    actionList: () => ({
        paddingTop: isDesktopApp() ? 70 : 0,
        width: '100%',
    }),
    actionItem: () => ({
        'width': '100%',
        'display': 'flex',
        'flexDirection': 'row',
        'alignItems': 'center',
        'gap': '20px',
        '&:hover $actionOperation': {
            display: 'flex',
        },
    }),
    actionContent: () => ({
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        width: '100%',
        overflow: 'hidden',
    }),
    actionOperation: {
        'flexShrink': 0,
        'display': 'none',
        'flexDirection': 'row',
        'alignItems': 'center',
        'marginLeft': 'auto',
        'gap': 10,
        '@media (min-width: 540px)': {
            // 当屏幕宽度大于400px时应用以下样式
            'display': 'flex', // 始终为 flex
            'opacity': 0, // 默认透明度为0，使其不可见
            'transition': 'opacity 0.3s ease', // 过渡效果
            '&:hover': {
                opacity: 1, // 鼠标悬停时透明度为1
            },
        },
    },
    name: {
        fontSize: '16px',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    prompts: (props: IThemedStyleProps) => ({
        'color': props.theme.colors.contentSecondary,
        'fontSize': '12px',
        'display': 'flex',
        'flexDirection': 'column',
        'gap': '3px',
        '& > div': {
            'display': '-webkit-box',
            'overflow': 'hidden',
            'lineHeight': '1.5',
            'maxWidth': '12px',
            'textOverflow': 'ellipsis',
            '-webkit-line-clamp': 2,
            '-webkit-box-orient': 'vertical',
        },
    }),
    metadata: (props: IThemedStyleProps) => ({
        color: props.theme.colors.contentSecondary,
        fontSize: '12px',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: '6px',
    }),
})

export interface IActionManagerProps {
    draggable?: boolean
}

export function ActionManager({ draggable = true }: IActionManagerProps) {
    const [refreshActionsFlag, refreshActions] = useReducer((x: number) => x + 1, 0)
    const { t } = useTranslation()
    const { theme, themeType } = useTheme()
    const [css] = useStyletron()
    const styles = useStyles({ theme, themeType })
    const { actions } = useChatStore()
    const [showActionForm, setShowActionForm] = useState(false)
    const [updatingAction, setUpdatingAction] = useState<Action>()
    const [deletingAction, setDeletingAction] = useState<Action>()
    const [openGroups, setOpenGroups] = useState<string[]>([])
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [activeType, setActiveType] = useState<'user' | 'built-in' | 'store'>('user')
    if (!actions) {
        return null
    }

    // 根据选择的标签过滤 actions
    const filteredActions =
        activeType === 'user'
            ? actions.filter((action) => action.mode !== 'built-in')
            : actions.filter((action) => action.mode === 'built-in')

    const actionGroups = filteredActions.reduce((groups: { [key: string]: Action[] }, action) => {
        // 每个 action 可能属于多个 group
        action.groups.forEach((group) => {
            if (!groups[group]) {
                groups[group] = []
            }
            groups[group].push(action)
        })
        return groups
    }, {})

    const TagButton = ({ type, label }: { type: 'user' | 'built-in' | 'store'; label: string }) => (
        <Tag
            closeable={false}
            kind={activeType === type ? KIND.primary : KIND.neutral}
            onClick={() => setActiveType(type)}
            overrides={{
                Root: {
                    style: {
                        'marginRight': '10px',
                        'cursor': 'pointer',
                        'borderRadius': '16px',
                        'padding': '6px 12px',
                        'fontSize': '14px',
                        'fontWeight': activeType === type ? 'bold' : 'normal',
                        'border': `2px solid ${activeType === type ? theme.colors.primary : theme.colors.borderOpaque}`,
                        'backgroundColor':
                            activeType === type ? theme.colors.primary : theme.colors.backgroundSecondary,
                        'color': activeType === type ? theme.colors.white : theme.colors.contentPrimary,
                        ':hover': {
                            backgroundColor:
                                activeType === type ? theme.colors.primary700 : theme.colors.backgroundTertiary,
                        },
                    },
                },
            }}
        >
            {label}
        </Tag>
    )

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            console.log('Handling file change')

            // 检查是否有文件被选中
            if (!event.target.files || event.target.files.length === 0) {
                console.error('No file selected')
                return // 没有文件被选中时退出函数
            }

            const file = event.target.files[0]

            if (!file) {
                console.error('No file found')
                return // 文件对象为空时退出函数
            }

            // 检查文件类型（可选）
            if (file.type !== 'application/json') {
                console.error('Invalid file type:', file.type)
                return // 文件类型不匹配时退出函数
            }

            const importActions = await jsonToActions(file)

            // 检查导入的数据是否有效
            if (!importActions || importActions.length === 0) {
                console.error('No valid actions to import')
                return // 导入的数据为空或无效时退出函数
            }

            actions.push(...importActions)

            refreshActions()
        } catch (error) {
            console.error('Error handling file change:', error)
        }
    }

    const ExportActions = async (group: string) => {
        try {
            const filteredActions = actions.filter((action) => {
                return action.groups.includes(group)
            })
            await exportToJson<Action>(group + `-${new Date().valueOf()}`, filteredActions)
        } catch (e) {
            console.error(e)
        }
    }

    return (
        <>
            <div
                className={styles.root}
                style={{
                    width: !draggable ? '800px' : undefined,
                }}
            >
                <div
                    className={css({
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        padding: '20px 0',
                        borderBottom: `1px solid ${theme.colors.borderOpaque}`,
                        marginBottom: '20px',
                    })}
                >
                    <TagButton type='user' label={t('Actions')} />
                    <TagButton type='built-in' label={t('Built-in Actions')} />
                    <TagButton type='store' label={t('Store')} />
                </div>
                {activeType !== 'store' && (
                    <>
                        <div className={styles.header} data-tauri-drag-region>
                            <div className={styles.iconContainer}>
                                <img data-tauri-drag-region className={styles.icon} src={icon} />
                                <div className={styles.iconText}>{t('Action Manager')}</div>
                            </div>
                            <div
                                style={{
                                    marginRight: 'auto',
                                }}
                            />
                            <div className={styles.operationList}>
                                <Button
                                    size='mini'
                                    kind='secondary'
                                    onClick={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        setUpdatingAction(undefined)
                                        setShowActionForm(true)
                                    }}
                                >
                                    {t('Create')}
                                </Button>
                                <Button
                                    size='mini'
                                    kind='secondary'
                                    onClick={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        if (fileInputRef.current) {
                                            fileInputRef.current.click()
                                        }
                                    }}
                                >
                                    {t('Import')}
                                </Button>
                            </div>
                        </div>
                        <input type='file' ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
                        <div className={styles.actionList}>
                            {Object.keys(actionGroups).map((group) => (
                                <div key={group}>
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                        }}
                                    >
                                        <h3
                                            style={{ cursor: 'pointer' }}
                                            onClick={() => {
                                                if (openGroups.includes(group)) {
                                                    setOpenGroups(openGroups.filter((g) => g !== group))
                                                } else {
                                                    setOpenGroups([...openGroups, group])
                                                }
                                            }}
                                        >
                                            {group}
                                        </h3>
                                        <Button
                                            size='mini'
                                            kind='secondary'
                                            onClick={() => {
                                                ExportActions(group)
                                            }}
                                        >
                                            {t('Export')}
                                        </Button>
                                    </div>
                                    {openGroups.includes(group) && (
                                        <List
                                            onChange={async ({ oldIndex, newIndex }) => {
                                                const groupActions = actionGroups[group]
                                                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                                                const newActions = arrayMove(groupActions!, oldIndex, newIndex)
                                                actions.push(...newActions)
                                                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                                                newActions.map((a, idx) => {
                                                    return {
                                                        ...a,
                                                        idx,
                                                    }
                                                })
                                                if (!isDesktopApp()) {
                                                    refreshActions()
                                                }
                                            }}
                                            items={actionGroups[group]?.map((action, idx) => (
                                                <div key={action.id} className={styles.actionItem}>
                                                    <div className={styles.actionContent}>
                                                        <div className={styles.name}>
                                                            {action.icon &&
                                                                createElement(
                                                                    (mdIcons as Record<string, IconType>)[action.icon],
                                                                    {
                                                                        size: 16,
                                                                    }
                                                                )}
                                                            {action.mode ? t(action.name) : action.name}
                                                            {action.mode && (
                                                                <div
                                                                    style={{
                                                                        display: 'inline-block',
                                                                        fontSize: '12px',
                                                                        background: theme.colors.backgroundTertiary,
                                                                        padding: '1px 4px',
                                                                        borderRadius: '2px',
                                                                    }}
                                                                >
                                                                    {t('built-in')}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className={styles.metadata}>
                                                            <div>
                                                                {t('Created At')}{' '}
                                                                {format(+action?.createdAt, 'yyyy-MM-dd HH:mm:ss')}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className={styles.actionOperation}>
                                                        {!draggable && (
                                                            <>
                                                                <Button
                                                                    size='mini'
                                                                    kind='secondary'
                                                                    disabled={idx === 0}
                                                                    onClick={async (e) => {
                                                                        e.preventDefault()
                                                                        e.stopPropagation()
                                                                        const newActions = arrayMove(
                                                                            actions,
                                                                            idx,
                                                                            idx - 1
                                                                        )
                                                                        actions.push(...newActions)
                                                                        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                                                                        newActions.map((a, idx) => {
                                                                            return {
                                                                                ...a,
                                                                                idx,
                                                                            }
                                                                        })
                                                                        if (!isDesktopApp()) {
                                                                            refreshActions()
                                                                        }
                                                                    }}
                                                                >
                                                                    <MdArrowUpward size={12} />
                                                                </Button>
                                                                <Button
                                                                    size='mini'
                                                                    kind='secondary'
                                                                    disabled={idx === actions.length - 1}
                                                                    onClick={async (e) => {
                                                                        e.preventDefault()
                                                                        e.stopPropagation()
                                                                        const newActions = arrayMove(
                                                                            actions,
                                                                            idx,
                                                                            idx + 1
                                                                        )
                                                                        actions.push(...newActions)
                                                                        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                                                                        newActions.map((a, idx) => {
                                                                            return {
                                                                                ...a,
                                                                                idx,
                                                                            }
                                                                        })
                                                                        if (!isDesktopApp()) {
                                                                            refreshActions()
                                                                        }
                                                                    }}
                                                                >
                                                                    <MdArrowDownward size={12} />
                                                                </Button>
                                                            </>
                                                        )}
                                                        <Button
                                                            size='mini'
                                                            kind='secondary'
                                                            startEnhancer={<FiEdit size={12} />}
                                                            onClick={(e) => {
                                                                e.preventDefault()
                                                                e.stopPropagation()
                                                                setUpdatingAction(action)
                                                                setShowActionForm(true)
                                                            }}
                                                        >
                                                            {action.mode === 'built-in' ? t('View') : t('Update')}
                                                        </Button>
                                                        <Button
                                                            size='mini'
                                                            kind='secondary'
                                                            disabled={action.mode === 'built-in'}
                                                            startEnhancer={<RiDeleteBinLine size={12} />}
                                                            onClick={(e) => {
                                                                e.preventDefault()
                                                                e.stopPropagation()
                                                                setDeletingAction(action)
                                                            }}
                                                        >
                                                            {t('Delete')}
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        />
                                    )}
                                </div>
                            ))}
                            <Modal
                                isOpen={showActionForm}
                                onClose={() => {
                                    setShowActionForm(false)
                                    setUpdatingAction(undefined)
                                }}
                                closeable
                                size='default'
                                autoFocus
                                animate
                                role='dialog'
                            >
                                <ModalHeader>
                                    {updatingAction ? t('Update sth', [t('Action')]) : t('Create sth', [t('Action')])}
                                </ModalHeader>
                                <ModalBody>
                                    <ActionForm
                                        action={updatingAction}
                                        onSubmit={() => {
                                            setShowActionForm(false)
                                            if (!isDesktopApp()) {
                                                refreshActions()
                                            }
                                        }}
                                    />
                                </ModalBody>
                            </Modal>
                            <Modal
                                isOpen={!!deletingAction}
                                onClose={() => {
                                    setDeletingAction(undefined)
                                }}
                                closeable
                                size='default'
                                autoFocus
                                animate
                                role='dialog'
                            >
                                <ModalHeader>{t('Delete sth', [t('Action')])}</ModalHeader>
                                <ModalBody>
                                    {t('Are you sure to delete sth?', [`${t('Action')} ${deletingAction?.name}`])}
                                </ModalBody>
                                <ModalFooter>
                                    <ModalButton
                                        size='compact'
                                        kind='tertiary'
                                        onClick={() => {
                                            setDeletingAction(undefined)
                                        }}
                                    >
                                        {t('Cancel')}
                                    </ModalButton>
                                    <ModalButton
                                        size='compact'
                                        onClick={async () => {
                                            actions.splice(actions.indexOf(deletingAction as Action), 1)
                                            if (!isDesktopApp()) {
                                                refreshActions()
                                            }
                                            setDeletingAction(undefined)
                                        }}
                                    >
                                        {t('Ok')}
                                    </ModalButton>
                                </ModalFooter>
                            </Modal>
                        </div>
                    </>
                )}
            </div>
            {activeType === 'store' && <ActionStore />}
        </>
    )
}
