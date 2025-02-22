import { useTranslation } from 'react-i18next'
import { ICreateActionOption } from '../internal-services/action'
import { Action } from '../internal-services/db'
import { createForm } from './Form'
import { Input } from 'baseui-sd/input'
import { Textarea } from 'baseui-sd/textarea'
import { Button } from 'baseui-sd/button'
import { useCallback, useState } from 'react'
import { createUseStyles } from 'react-jss'
import { IThemedStyleProps } from '../types'
import { useTheme } from '../hooks/useTheme'
import { RenderingFormatSelector } from './RenderingFormatSelector'
import ModelSelect from './ModelSelect'
import GroupSelect from './GroupSelect'
import { StatefulTooltip } from 'baseui-sd/tooltip'
import { useChatStore } from '@/store/file/store'
import { CheckBox } from './CheckBox'
import { IconPicker } from './IconPicker'

const useStyles = createUseStyles({
    placeholder: (props: IThemedStyleProps) => ({
        color: props.theme.colors.positive,
    }),
    promptCaptionContainer: () => ({
        'lineHeight': 1.8,
        '& *': {
            '-ms-user-select': 'text',
            '-webkit-user-select': 'text',
            'user-select': 'text',
        },
    }),
    placeholderCaptionContainer: () => ({
        listStyle: 'square',
        margin: 0,
        padding: 0,
        marginTop: 10,
        paddingLeft: 20,
    }),
})

export interface IActionFormProps {
    action?: Action
    onSubmit: (action: Action) => void
}

const { Form, FormItem } = createForm<ICreateActionOption>()

export function ActionForm(props: IActionFormProps) {
    const { createAction, updateAction } = useChatStore()
    const { theme, themeType } = useTheme()
    const styles = useStyles({ theme, themeType })
    const { t } = useTranslation()
    const [loading, setLoading] = useState(false)
    const onSubmit = useCallback(
        async (values: ICreateActionOption) => {
            setLoading(true)
            let action: Action
            if (props.action) {
                action = await updateAction(props.action, values)
            } else {
                action = await createAction(values)
            }
            props.onSubmit(action)
            setLoading(false)
        },
        [props, createAction, updateAction]
    )

    const actionGroupsPlaceholderCaption = (
        <ul className={styles.placeholderCaptionContainer}>
            <li>
                <span className={styles.placeholder}>{t("Action's Groups")}</span>{' '}
                {t('Determine which groups this action belongs to')}
            </li>
        </ul>
    )

    const rolePlaceholdersCaption = (
        <ul className={styles.placeholderCaptionContainer}>
            <li>
                <span className={styles.placeholder}>{'${sourceLang}'}</span> {t('The Language You Want to Learn')}
            </li>
            <li>
                <span className={styles.placeholder}>{'${targetLang}'}</span> {t('The Language You are Using')}
            </li>
        </ul>
    )

    const commandPlaceholdersCaption = (
        <ul className={styles.placeholderCaptionContainer}>
            <li>
                <span className={styles.placeholder}>{'${sourceLang}'}</span> {t('The Language You Want to Learn')}
            </li>
            <li>
                <span className={styles.placeholder}>{'${targetLang}'}</span> {t('The Language You are Using')}
            </li>
            <li>
                <span className={styles.placeholder}>{'${text}'}</span>{' '}
                {t(
                    'represents the original text, which is usually not needed inside the prompt because it is automatically injected'
                )}
            </li>
        </ul>
    )

    const rolePromptCaption = (
        <div className={styles.promptCaptionContainer}>
            <div>{t('Role prompt indicates what role the action represents.')}</div>
            <div>{t('Role prompt example: You are a translator.')}</div>
            <div>{t('Placeholders')}:</div>
            <div>{rolePlaceholdersCaption}</div>
        </div>
    )

    const actionGroupsCaption = (
        <div className={styles.promptCaptionContainer}>
            <div>{actionGroupsPlaceholderCaption}</div>
            <div>{t('You can set multiple group names')}</div>
        </div>
    )

    const commandPromptCaption = (
        <div className={styles.promptCaptionContainer}>
            <div>
                {t(
                    'Command prompt indicates what command should be issued to the role represented by the action when the action is executed.'
                )}
            </div>
            <div>
                {t('Command prompt example: Please translate the following text from ${sourceLang} to ${targetLang}.')}
            </div>
            <div>{t('Placeholders')}:</div>
            <div>{commandPlaceholdersCaption}</div>
        </div>
    )

    return (
        <Form initialValues={props.action} onFinish={onSubmit}>
            <FormItem required name='name' label={t('Name')}>
                <Input size='compact' />
            </FormItem>
            <FormItem required name='groups' label={t("Action's Groups")} caption={actionGroupsCaption}>
                <GroupSelect
                    intialTags={props.action?.groups || []}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault() // 阻止事件冒泡
                            e.stopPropagation()
                        }
                    }}
                />
            </FormItem>
            <FormItem required name='icon' label={t('Icon')}>
                <IconPicker />
            </FormItem>
            <FormItem name='rolePrompt' label={t('Role Prompt')} caption={rolePromptCaption}>
                <Textarea size='compact' />
            </FormItem>
            <FormItem required name='commandPrompt' label={t('Command Prompt')} caption={commandPromptCaption}>
                <Textarea size='compact' />
            </FormItem>

            <FormItem name='useBackgroundInfo'>
                <CheckBox
                    label={t('Use Background Info') || 'Use Background Info'}
                    labelSmall={
                        t('Use your background information in the current feature') ||
                        'Use your background information in the current feature'
                    }
                />
            </FormItem>

            <FormItem name='useLanguageLevelInfo'>
                <CheckBox
                    label={t('Use Language Level') || 'Use Language Level'}
                    labelSmall={
                        t('Use your language level in the current feature') ||
                        'Use your language level in the current feature'
                    }
                />
            </FormItem>

            <FormItem name='isFrequentlyUsed'>
                <CheckBox
                    label={t('Frequently Used') || 'Frequently Used'}
                    labelSmall={t('Show this action in quick access bar') || 'Show this action in quick access bar'}
                />
            </FormItem>

            <FormItem name='model' label={t('API Model')}>
                <ModelSelect></ModelSelect>
            </FormItem>
            <FormItem name='outputRenderingFormat' label={t('Output rendering format')}>
                <RenderingFormatSelector />
            </FormItem>

            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexDirection: 'row',
                    gap: 10,
                }}
            >
                <div
                    style={{
                        marginRight: 'auto',
                    }}
                />
                <StatefulTooltip
                    content={
                        props.action?.mode === 'built-in'
                            ? t('Built-in actions cannot be modified')
                            : t('Save changes to this action')
                    }
                    placement='top'
                >
                    <span>
                        <Button isLoading={loading} size='compact' disabled={props.action?.mode === 'built-in'}>
                            {t('Save')}
                        </Button>
                    </span>
                </StatefulTooltip>
            </div>
        </Form>
    )
}
