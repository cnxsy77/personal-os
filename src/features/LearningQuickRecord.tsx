import { useState, type FormEvent } from 'react'
import { GraduationCap, Timer } from 'lucide-react'
import type { StudyLog, StudyLogInput } from '../data/model'
import {
  formatStudyDuration,
  getRecentStudyMinutes,
  getStudyMinutesOnDate,
  toDateKey,
} from '../utils/study'
import './LearningQuickRecord.css'

type Props = {
  studyLogs: StudyLog[]
  onSubmit: (input: StudyLogInput) => void
}

export function LearningQuickRecord({ studyLogs, onSubmit }: Props) {
  const [topic, setTopic] = useState('')
  const [minutes, setMinutes] = useState('')
  const [error, setError] = useState('')
  const now = new Date()
  const today = toDateKey(now)
  const todayMinutes = getStudyMinutesOnDate(studyLogs, today)
  const weekMinutes = getRecentStudyMinutes(studyLogs, now)

  function submit(event: FormEvent) {
    event.preventDefault()
    const normalizedTopic = topic.trim()
    const normalizedMinutes = Number(minutes)

    if (!normalizedTopic) {
      setError('请填写学习主题')
      return
    }

    if (!Number.isInteger(normalizedMinutes) || normalizedMinutes <= 0) {
      setError('请输入大于 0 的学习时长')
      return
    }

    onSubmit({
      topic: normalizedTopic,
      minutes: normalizedMinutes,
      date: today,
    })
    setTopic('')
    setMinutes('')
    setError('')
  }

  return (
    <section className="learning-panel" aria-labelledby="learning-title">
      <h2 id="learning-title">学习记录</h2>

      <div className="learning-summary">
        <div>
          <label>今日学习</label>
          <strong>{formatStudyDuration(todayMinutes)}</strong>
        </div>
        <div>
          <label>近 7 天</label>
          <strong>{formatStudyDuration(weekMinutes)}</strong>
        </div>
      </div>

      <form onSubmit={submit} className="learning-form">
        <div className="learning-fields">
          <div className="learning-topic">
            <label htmlFor="learning-topic">学习主题</label>
            <input
              id="learning-topic"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="React 渲染模型"
            />
          </div>
          <div>
            <label htmlFor="learning-minutes">时长</label>
            <input
              id="learning-minutes"
              value={minutes}
              onChange={(event) => setMinutes(event.target.value)}
              inputMode="numeric"
              type="number"
              min="1"
              step="1"
              placeholder="45"
            />
          </div>
          <button type="submit">记录</button>
        </div>
        {error ? <p role="alert">{error}</p> : null}
      </form>

      <div className="learning-list-heading">
        <h3>最近学习</h3>
      </div>
      <ul aria-label="学习记录">
        {studyLogs.slice(0, 8).map((log) => (
          <li key={log.id}>
            <i>
              <GraduationCap size={17} />
            </i>
            <div>
              <h4>{log.topic}</h4>
              <p>{formatDate(log.date)}</p>
            </div>
            <b>
              <Timer size={14} />
              {formatStudyDuration(log.minutes)}
            </b>
          </li>
        ))}
      </ul>
    </section>
  )
}

function formatDate(date: string) {
  return date.replaceAll('-', '.')
}
