import { useState, useRef, ChangeEvent, useEffect } from 'react'
import { Select } from 'baseui-sd/select'
import { AiOutlineUpload, AiOutlineDelete } from 'react-icons/ai'
import { useChatStore } from '@/store/file/store'
import { LuArrowLeftFromLine, LuArrowRightToLine } from 'react-icons/lu'
import { Button, KIND, SIZE } from 'baseui-sd/button'
import { fileService } from '../internal-services/file'
import { useTranslation } from 'react-i18next'

const CategorySelector = () => {
    const {
        files,
        categories,
        currentFileId,
        selectedCategory,
        addFile,
        selectFile,
        deleteFile,
        addCategory,
        deleteCategory,
        loadFiles,
        setSelectedCategory,
        setShowWordBookManager,
    } = useChatStore()
    const [showNewCategoryInput, setShowNewCategoryInput] = useState(false)
    const [newCategory, setNewCategory] = useState('')
    const [hoverCategory, setHoverCategory] = useState<string | null>(null)
    const [showSelectBox, setShowSelectBox] = useState(false)
    const [showCategories, setShowCategories] = useState(true)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [isHovering, setIsHovering] = useState(false)
    const { t } = useTranslation()

    useEffect(() => {
        setShowSelectBox(!currentFileId)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const toggleCategories = () => setShowCategories(!showCategories)

    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files ? event.target.files[0] : null
        if (file && selectedCategory) {
            addFile(file, selectedCategory)
        }
        setShowSelectBox(false)
    }

    const handleCategoryChange = async (cat: string) => {
        setShowSelectBox(true)
        setSelectedCategory(cat)
        setHoverCategory(cat)
        localStorage.setItem('currentCategory', JSON.stringify(cat))
        loadFiles(cat)
    }

    const handleAddCategory = () => {
        if (newCategory?.trim()) {
            addCategory(newCategory)
        }
        setShowNewCategoryInput(false)
    }

    const handleDeleteCategory = async (cat: string) => {
        deleteCategory(cat)
        await fileService.deleteFilesByCategory(cat)
    }

    const options = [
        ...files.map((file) => ({
            id: file.id,
            label: file.name,
        })),
        { id: 0, label: t('Download') }
    ]

    const onChange = (params: { value: { id: number; label: string }[] }) => {
        const { value } = params
        if (value.length > 0 && value[0].id === 0) {
            setShowWordBookManager(true)
        } else {
            selectFile(value[0].id)
        }
    }

    // 在渲染前检查 currentFileId 和 files 是否有效
    const validValue = files.some((file) => file.id === currentFileId)
        ? options.filter((option) => option.id === currentFileId)
        : []

    return (
        <div style={{ minHeight: '14px' }}>
            <div
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
                style={{ minHeight: '14px', cursor: 'pointer', backgroundColor: 'rgba(0, 0, 0, 0)' }}
            >
                {isHovering &&
                    (showCategories ? (
                        <LuArrowLeftFromLine onClick={toggleCategories} style={{ fontSize: '14px' }} />
                    ) : (
                        <LuArrowRightToLine onClick={toggleCategories} style={{ fontSize: '14px' }} />
                    ))}

                {showCategories &&
                    categories.map((cat) => (
                        <div
                            key={cat}
                            onMouseEnter={() => setHoverCategory(cat)}
                            onMouseLeave={() => setHoverCategory(null)}
                            style={{ display: 'inline-block', position: 'relative' }}
                        >
                            <Button
                                onClick={() => handleCategoryChange(cat)}
                                kind={KIND.tertiary}
                                size={SIZE.compact}
                                style={{ fontWeight: selectedCategory === cat ? 'bold' : 'normal' }}
                            >
                                <u>{t(cat)}</u>
                                {hoverCategory === cat && cat !== 'History' && cat !== 'Review' && (
                                    <span
                                        onClick={(e) => {
                                            e.stopPropagation() // 阻止点击事件冒泡到 Button
                                            handleDeleteCategory(cat)
                                        }}
                                        style={{
                                            position: 'absolute',
                                            right: '2px',
                                            top: '-5px',
                                            cursor: 'pointer',
                                            color: 'black',
                                        }}
                                    >
                                        x
                                    </span>
                                )}
                            </Button>
                        </div>
                    ))}
                {showCategories && (
                    <Button
                        onClick={() => setShowNewCategoryInput(!showNewCategoryInput)}
                        kind={KIND.tertiary}
                        size={SIZE.compact}
                    >
                        +
                    </Button>
                )}
                {showNewCategoryInput && (
                    <div style={{ display: 'flex', flexDirection: 'row', maxWidth: '50%', maxHeight: '28px' }}>
                        <input
                            type='text'
                            value={newCategory}
                            onChange={(e) => setNewCategory(e.target.value)}
                            placeholder={t('Create a new category') ?? 'Create a new category'}
                        />
                        <Button
                            kind={KIND.tertiary}
                            size={SIZE.mini}
                            onClick={() => {
                                handleAddCategory()
                                setShowNewCategoryInput(false)
                            }}
                        >
                            √
                        </Button>
                    </div>
                )}
                {showSelectBox && showCategories && (
                    <div style={{ display: 'flex', alignItems: 'center', width: '50%', maxWidth: '300px' }}>
                        <Select
                            size={SIZE.compact}
                            options={options}
                            labelKey='label'
                            valueKey='id'
                            onChange={onChange}
                            value={validValue}
                            placeholder={t('Select a file') ?? 'Select a file'}
                            overrides={{
                                Root: {
                                    style: ({ $theme }) => ({
                                        flexGrow: 1,
                                        flexShrink: 1,
                                        flexBasis: '0%', // 允许Select缩减至极小的宽度
                                    }),
                                },
                                ControlContainer: {
                                    style: ({ $theme }) => ({
                                        'fontSize': '14px', // 调整字体大小
                                        'lineHeight': '12px', // 调整行高
                                        'height': '38px',
                                        'maxWidth': '300px',
                                        'backgroundColor': 'rgba(255, 255, 255, 0.5)',
                                        ':hover': {
                                            borderColor: $theme.colors.borderPositive,
                                        },
                                    }),
                                },
                                DropdownListItem: {
                                    style: ({ $theme }) => ({
                                        'maxWidth': '300px',
                                        'backgroundColor': $theme.colors.backgroundSecondary,
                                        ':hover': {
                                            backgroundColor: $theme.colors.backgroundTertiary,
                                        },
                                    }),
                                },
                                Placeholder: {
                                    style: ({ $theme }) => ({
                                        color: $theme.colors.contentSecondary,
                                    }),
                                },
                                SingleValue: {
                                    style: ({ $theme }) => ({
                                        color: $theme.colors.contentPrimary,
                                    }),
                                },
                            }}
                        />

                        <AiOutlineUpload
                            title={t('Upload a file') ?? 'Upload a file'}
                            onClick={(e) => {
                                e.stopPropagation()
                                if (fileInputRef.current) {
                                    fileInputRef.current.click()
                                }
                            }}
                            style={{
                                marginLeft: '5px',
                                cursor: 'pointer',
                                color: 'green',
                                fontSize: '18px',
                                flexShrink: 0,
                            }}
                        />

                        <AiOutlineDelete
                            title={t('Delete this file') ?? 'Delete this file'}
                            onClick={(e) => {
                                e.stopPropagation()
                                deleteFile(currentFileId)
                                loadFiles(t(selectedCategory))
                            }}
                            style={{
                                marginLeft: '5px',
                                cursor: 'pointer',
                                color: 'black',
                                fontSize: '18px',
                                flexShrink: 0,
                            }}
                        />
                        <input
                            ref={fileInputRef}
                            type='file'
                            onChange={handleFileChange}
                            accept='.csv'
                            style={{ display: 'none' }}
                        />
                        <div></div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default CategorySelector
