import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { createLocalPersonalOSData } from './data/localPersonalOSData'
import { createMemoryStorage } from './test/memoryStorage'

describe('learning quick capture', () => {
  it('records a study log and updates the dashboard summary', async () => {
    const user = userEvent.setup()
    const data = createLocalPersonalOSData({ storage: createMemoryStorage() })
    render(<App data={data} />)

    await user.click(screen.getByRole('button', { name: '学习' }))
    expect(screen.getByText('还没有周复盘，可在添加弹窗中记录。')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '添加学习内容' }))
    await user.type(screen.getByLabelText('学习主题'), 'React 渲染模型')
    await user.type(screen.getByLabelText('时长（分钟）'), '45')
    await user.click(screen.getByRole('button', { name: '记录学习' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('学习记录已保存')).toBeInTheDocument()
    expect(screen.getAllByText('1 小时 30 分').length).toBeGreaterThan(0)

    const records = screen.getByRole('list', { name: '学习记录' })
    expect(records).toHaveTextContent('React 渲染模型')

    await user.click(screen.getByRole('button', { name: '概览' }))
    expect(screen.getByText('1 小时 30 分')).toBeInTheDocument()
  })

  it('creates a B站 course, adds lessons, and tracks completion progress', async () => {
    const user = userEvent.setup()
    const data = createLocalPersonalOSData({ storage: createMemoryStorage() })
    render(<App data={data} />)

    await user.click(screen.getByRole('button', { name: '学习' }))
    await user.click(screen.getByRole('button', { name: '添加学习内容' }))
    await user.click(screen.getByRole('tab', { name: '课程' }))
    await user.type(screen.getByLabelText('课程名称'), 'React 官方课程')
    await user.type(
      screen.getByLabelText('课程链接'),
      'https://www.bilibili.com/video/BV1q5YL69E44/',
    )
    expect(screen.getByLabelText('来源平台')).toHaveValue('bilibili')
    await user.click(screen.getByRole('button', { name: '保存课程' }))

    expect(data.getSnapshot().learningResources[0]).toMatchObject({
      title: 'React 官方课程',
      platform: 'bilibili',
      externalId: 'BV1q5YL69E44',
    })

    await user.click(screen.getAllByRole('button', { name: '添加课时' })[0])
    await user.selectOptions(
      screen.getByRole('combobox', { name: '课程' }),
      screen.getByRole('option', { name: 'React 官方课程' }),
    )
    await user.type(
      screen.getByLabelText('课时目录'),
      '第一节 渲染入门 | 20\n第二节 Hooks 基础 | 35',
    )
    await user.click(screen.getByRole('button', { name: '保存课时目录' }))

    expect(data.getSnapshot().learningLessons).toHaveLength(2)
    await user.selectOptions(
      screen.getByLabelText('React 官方课程 第一节 渲染入门 状态'),
      'done',
    )

    const progress = screen.getByLabelText('React 官方课程 课时进度')
    expect(progress).toHaveAttribute('max', '2')
    expect(progress).toHaveAttribute('value', '1')
    expect(data.getSnapshot().learningLessons[0]).toMatchObject({
      title: '第一节 渲染入门',
      expectedMinutes: 20,
      status: 'done',
    })
  })

  it('links a study log to a lesson and recommends continue learning', async () => {
    const user = userEvent.setup()
    const data = createLocalPersonalOSData({ storage: createMemoryStorage() })
    const courseId = data.getSnapshot().learningResources[0].id

    data.addLearningLessons(courseId, [
      { title: '第一节 架构总览' },
      { title: '第二节 渲染模型' },
    ])
    data.setLearningLessonStatus(
      data.getSnapshot().learningLessons[0].id,
      'doing',
    )
    render(<App data={data} />)

    await user.click(screen.getByRole('button', { name: '学习' }))
    await user.click(screen.getByRole('button', { name: '添加学习内容' }))
    await user.selectOptions(
      screen.getByRole('combobox', { name: '课程' }),
      screen.getByRole('option', { name: 'React 官方文档' }),
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: '课时' }),
      screen.getByRole('option', { name: '第一节 架构总览' }),
    )
    await user.type(screen.getByLabelText('学习主题'), '渲染模型复盘')
    await user.type(screen.getByLabelText('时长（分钟）'), '30')
    await user.type(screen.getByLabelText('学习备注'), '下次继续 reconcile')
    await user.click(screen.getByRole('button', { name: '记录学习' }))

    const continueCard = screen.getByRole('region', { name: '继续学习' })
    expect(continueCard).toHaveTextContent('第一节 架构总览')
    expect(screen.getByRole('list', { name: '学习记录' })).toHaveTextContent(
      'React 官方文档 · 第一节 架构总览',
    )
    expect(data.getSnapshot().studyLogs[0]).toMatchObject({
      topic: '渲染模型复盘',
      resourceId: courseId,
      lessonId: data.getSnapshot().learningLessons[0].id,
      note: '下次继续 reconcile',
    })
  })

  it('creates folders and notes, then searches and filters the note library', async () => {
    const user = userEvent.setup()
    const data = createLocalPersonalOSData({ storage: createMemoryStorage() })
    render(<App data={data} />)

    await user.click(screen.getByRole('button', { name: '学习' }))
    await user.click(screen.getByRole('button', { name: '添加笔记' }))
    await user.type(screen.getByLabelText('新文件夹'), '课程笔记')
    await user.click(screen.getByRole('button', { name: '创建' }))
    await user.selectOptions(
      screen.getByRole('combobox', { name: '笔记文件夹' }),
      screen.getByRole('option', { name: '课程笔记' }),
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: '关联课程' }),
      screen.getByRole('option', { name: 'React 官方文档' }),
    )
    await user.type(screen.getByLabelText('笔记标题'), 'React 学习结论')
    await user.type(screen.getByLabelText('标签'), 'React, 架构')
    await user.type(
      screen.getByLabelText('笔记内容'),
      '优先掌握组件模型和渲染流程。',
    )
    await user.click(screen.getByRole('button', { name: '保存笔记' }))

    const noteList = screen.getByRole('list', { name: '学习笔记' })
    expect(noteList).toHaveTextContent('React 学习结论')
    expect(noteList).toHaveTextContent('#React')
    expect(data.getSnapshot().learningNotes[0]).toMatchObject({
      title: 'React 学习结论',
      tags: ['React', '架构'],
      resourceId: data.getSnapshot().learningResources[0].id,
    })

    await user.type(screen.getByLabelText('搜索笔记'), '没有这段内容')
    expect(screen.getByText('还没有匹配的笔记')).toBeInTheDocument()
    await user.clear(screen.getByLabelText('搜索笔记'))
    await user.type(screen.getByLabelText('搜索笔记'), '架构')
    expect(screen.getByRole('list', { name: '学习笔记' })).toHaveTextContent(
      'React 学习结论',
    )
  })

  it('saves a weekly review and replaces the same week on resave', async () => {
    const user = userEvent.setup()
    const data = createLocalPersonalOSData({ storage: createMemoryStorage() })
    render(<App data={data} />)

    await user.click(screen.getByRole('button', { name: '学习' }))
    await user.click(screen.getByRole('button', { name: '添加学习内容' }))
    await user.click(screen.getByRole('tab', { name: '周复盘' }))
    await user.type(screen.getByLabelText('本周收获'), '完成学习路径设计')
    await user.type(screen.getByLabelText('本周阻碍'), '晚上时间不足')
    await user.type(screen.getByLabelText('下周重点'), '补齐项目测试')
    await user.click(screen.getByRole('button', { name: '保存复盘' }))

    const reviews = screen.getByRole('list', { name: '周复盘记录' })
    expect(reviews).toHaveTextContent('完成学习路径设计')

    await user.click(screen.getByRole('button', { name: '添加学习内容' }))
    await screen.findByRole('dialog', { name: '添加学习内容' })
    await user.click(screen.getByRole('tab', { name: '周复盘' }))
    await user.clear(screen.getByLabelText('本周收获'))
    await user.type(screen.getByLabelText('本周收获'), '完成学习路径和复盘')
    await user.clear(screen.getByLabelText('本周阻碍'))
    await user.type(screen.getByLabelText('本周阻碍'), '晚上时间仍然不足')
    await user.clear(screen.getByLabelText('下周重点'))
    await user.type(screen.getByLabelText('下周重点'), '完成学习计划联调')
    await user.click(screen.getByRole('button', { name: '保存复盘' }))

    expect(data.getSnapshot().weeklyReviews).toHaveLength(1)
    expect(data.getSnapshot().weeklyReviews[0].wins).toBe(
      '完成学习路径和复盘',
    )
  })

  it('keeps the dialog open when the study log is invalid', async () => {
    const user = userEvent.setup()
    const data = createLocalPersonalOSData({ storage: createMemoryStorage() })
    render(<App data={data} />)

    await user.click(screen.getByRole('button', { name: '学习' }))
    await user.click(screen.getByRole('button', { name: '添加学习内容' }))
    await user.click(screen.getByRole('button', { name: '记录学习' }))

    expect(
      screen.getByRole('dialog', { name: '添加学习内容' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('请填写学习主题')
    expect(data.getSnapshot().studyLogs).toHaveLength(1)
  })

  it('edits and deletes learning records after confirmation', async () => {
    const user = userEvent.setup()
    const data = createLocalPersonalOSData({ storage: createMemoryStorage() })
    data.addLearningPath({ title: '测试路径', targetMinutes: 600 })
    const pathId = data.getSnapshot().learningPaths.find(
      (path) => path.title === '测试路径',
    )?.id as string
    data.addLearningResource({
      pathId,
      title: '测试课程',
      kind: 'course',
      status: 'doing',
      platform: 'bilibili',
    })
    const resourceId = data.getSnapshot().learningResources.find(
      (resource) => resource.title === '测试课程',
    )?.id as string
    data.addLearningLessons(resourceId, [{ title: '第一课', expectedMinutes: 25 }])
    const lessonId = data.getSnapshot().learningLessons.find(
      (lesson) => lesson.title === '第一课',
    )?.id as string
    data.recordStudyLog({
      topic: '测试学习',
      minutes: 30,
      date: '2026-09-17',
      pathId,
      resourceId,
      lessonId,
      platform: 'bilibili',
    })
    const studyLogId = data.getSnapshot().studyLogs.find(
      (log) => log.topic === '测试学习',
    )?.id as string
    render(<App data={data} />)

    await user.click(screen.getByRole('button', { name: '学习' }))

    await user.click(screen.getByRole('button', { name: '编辑学习路径 测试路径' }))
    expect(screen.getByRole('dialog', { name: '编辑学习路径' })).toBeInTheDocument()
    expect(screen.getByLabelText('路径名称')).toHaveValue('测试路径')
    await user.clear(screen.getByLabelText('路径名称'))
    await user.type(screen.getByLabelText('路径名称'), '前端进阶路径')
    await user.click(screen.getByRole('button', { name: '保存路径修改' }))
    expect(screen.getByText('学习路径已更新')).toBeInTheDocument()
    expect(
      data.getSnapshot().learningPaths.find((path) => path.id === pathId),
    ).toMatchObject({
      id: pathId,
      title: '前端进阶路径',
    })

    await user.click(screen.getByRole('button', { name: '编辑学习记录 测试学习' }))
    expect(screen.getByRole('dialog', { name: '编辑学习记录' })).toBeInTheDocument()
    expect(screen.getByLabelText('学习主题')).toHaveValue('测试学习')
    await user.clear(screen.getByLabelText('学习主题'))
    await user.type(screen.getByLabelText('学习主题'), '渲染调度')
    await user.click(screen.getByRole('button', { name: '保存学习修改' }))
    expect(
      data.getSnapshot().studyLogs.find((log) => log.id === studyLogId),
    ).toMatchObject({
      topic: '渲染调度',
    })

    await user.click(screen.getByRole('button', { name: '编辑课时 第一课' }))
    expect(screen.getByRole('dialog', { name: '编辑课时' })).toBeInTheDocument()
    expect(screen.getByLabelText('课时标题')).toHaveValue('第一课')
    await user.clear(screen.getByLabelText('课时标题'))
    await user.type(screen.getByLabelText('课时标题'), '渲染入门')
    await user.click(screen.getByRole('button', { name: '保存课时修改' }))
    expect(
      data.getSnapshot().learningLessons.find((lesson) => lesson.id === lessonId),
    ).toMatchObject({
      title: '渲染入门',
    })

    await user.click(screen.getByRole('button', { name: '删除学习记录 渲染调度' }))
    await user.click(screen.getByRole('button', { name: '取消' }))
    expect(data.getSnapshot().studyLogs).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: '删除学习记录 渲染调度' }))
    await user.click(screen.getByRole('button', { name: '确认删除' }))
    expect(data.getSnapshot().studyLogs).toHaveLength(1)
  })
})
