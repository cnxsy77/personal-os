import type {
  WorkoutExercise,
  WorkoutInput,
  WorkoutKind,
} from '../data/model'

type CoachPlanDraft = {
  date: string
  focus?: string
  warmup: string[]
  exercises: WorkoutExercise[]
  finisher: string[]
  sorenessAreas: string[]
  coachNotes: string[]
}

const datePattern = /^(?:\d{4}年)?(\d{1,2})月(\d{1,2})日\s*[,，、]?\s*(.*)$/

export function parseCoachWorkoutPlans(
  text: string,
  now = new Date(),
): WorkoutInput[] {
  const lines = text
    .replaceAll('\u3000', ' ')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  let draft: CoachPlanDraft | null = null
  let waitingForSoreness = false
  const drafts: CoachPlanDraft[] = []

  for (const line of lines) {
    const dateMatch = line.match(datePattern)

    if (dateMatch) {
      if (draft) {
        drafts.push(draft)
      }

      const date = createDate(dateMatch[1], dateMatch[2], now)

      if (!date) {
        draft = null
        waitingForSoreness = false
        continue
      }

      draft = createDraft(date)
      waitingForSoreness = false
      const inlineTitle = normalizeLine(dateMatch[3])

      if (inlineTitle && looksLikeFocus(inlineTitle)) {
        draft.focus = inlineTitle
      } else if (inlineTitle) {
        draft.coachNotes.push(inlineTitle)
      }

      continue
    }

    if (!draft) {
      continue
    }

    if (isSorenessMarker(line)) {
      const areas = extractSorenessAreas(line)
      waitingForSoreness = areas.length === 0
      draft.sorenessAreas.push(...areas)
      continue
    }

    if (waitingForSoreness) {
      const areas = extractSorenessAreas(line)

      if (areas.length > 0) {
        draft.sorenessAreas.push(...areas)
        waitingForSoreness = false
        continue
      }
    }

    if (!draft.focus && looksLikeFocus(line)) {
      draft.focus = line
      continue
    }

    if (looksLikeFinisher(line)) {
      draft.finisher.push(line)
      continue
    }

    const exercise = parseExercise(line)

    if (exercise) {
      draft.exercises.push(exercise)
      continue
    }

    if (looksLikeWarmup(line)) {
      draft.warmup.push(line)
      continue
    }

    draft.coachNotes.push(line)
  }

  if (draft) {
    drafts.push(draft)
  }

  return drafts.map(createWorkoutInput)
}

function createDraft(date: string): CoachPlanDraft {
  return {
    date,
    warmup: [],
    exercises: [],
    finisher: [],
    sorenessAreas: [],
    coachNotes: [],
  }
}

function createWorkoutInput(draft: CoachPlanDraft): WorkoutInput {
  const focus = draft.focus ?? '训练'

  return {
    date: draft.date,
    kind: inferWorkoutKinds(focus, draft.exercises)[0],
    kinds: inferWorkoutKinds(focus, draft.exercises),
    status: 'completed',
    durationMinutes: 0,
    notes: '',
    focus,
    warmup: draft.warmup,
    exercises: draft.exercises,
    finisher: draft.finisher,
    sorenessAreas: draft.sorenessAreas,
    coachNotes: draft.coachNotes,
  }
}

function createDate(monthText: string, dayText: string, now: Date) {
  const month = Number(monthText)
  const day = Number(dayText)

  if (
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null
  }

  let year = now.getFullYear()

  if (new Date(year, month - 1, day, 23, 59, 59) > now) {
    year -= 1
  }

  const monthKey = String(month).padStart(2, '0')
  const dayKey = String(day).padStart(2, '0')
  const date = new Date(`${year}-${monthKey}-${dayKey}T00:00:00`)

  return Number.isNaN(date.getTime()) ? null : `${year}-${monthKey}-${dayKey}`
}

function isSorenessMarker(line: string) {
  return line.includes('延迟性酸痛') || line.includes('酸痛肌群')
}

function extractSorenessAreas(line: string) {
  const content = line
    .replace(/^.*?(?:延迟性酸痛|酸痛肌群)[：:]?/, '')
    .trim()

  if (!content) {
    return []
  }

  return normalizeLine(content)
    .split(/[,，、/]+/)
    .map((area) => normalizeLine(area))
    .filter(Boolean)
}

function looksLikeFocus(line: string) {
  return (
    line.length <= 10 &&
    !/(还没|没有|力量|强度|最近|灵活|热身|泡沫|酸痛|有点)/.test(line) &&
    /^(?:上肢|下肢|全身|胸|肩|背|腿|臀|核心|有氧|恢复)(?:[部肌]?(?:加|和|&|、)?(?:胸|肩|背|腿|臀|臂|核心))*(?:部)?(?:训练|日|训练日)?$/.test(
      line,
    )
  )
}

function looksLikeWarmup(line: string) {
  return /(热身|泡沫轴|松解|灵活度|激活)/.test(line)
}

function looksLikeFinisher(line: string) {
  return /(核心收尾|放松收尾|拉伸收尾)/.test(line)
}

function parseExercise(line: string): WorkoutExercise | null {
  const actionMatch =
    /(伸展|拉伸|卷腹|支撑|下拉|划船|推胸|飞鸟|夹胸|反向|蝴蝶|平举|推肩|硬拉|深蹲|髋外展|臀推|死虫子|臀桥|弯举|屈伸)/

  if (!actionMatch.test(line)) {
    return null
  }

  const symbolMatch = line.match(
    /(\d+\s*(?:[*×xX]\s*\d+)+|(?:[*×xX]\s*\d+))/,
  )
  const looseMatch = line.match(
    /((?:各)?[0-9一二两三四五六七八九十]+\s*组(?:[，,]?\s*每组\s*[0-9一二三四五六七八九十百]+\s*(?:个|次|秒|s|S)(?:左右)?)?(?:\s+[0-9]+\s*[sS秒])*)/i,
  )
  const prescription = symbolMatch?.[1] ?? looseMatch?.[1]

  if (!prescription) {
    return { name: normalizeLine(line) }
  }

  const matchIndex = symbolMatch?.index ?? looseMatch?.index ?? 0
  const name = normalizeLine(line.slice(0, matchIndex))
  const target = normalizeLine(
    line.slice(matchIndex + prescription.length),
  )

  return {
    name: name || normalizeLine(line),
    prescription,
    ...(target ? { target } : {}),
  }
}

function inferWorkoutKinds(
  focus: string,
  exercises: WorkoutExercise[],
): WorkoutKind[] {
  const content = `${focus} ${exercises.map((exercise) => exercise.name).join(' ')}`
  const selected = new Set<WorkoutKind>()

  if (/(臀|髋|臀推|髋外展)/.test(content)) {
    selected.add('glutes')
  }

  if (/(腿|下肢|深蹲|硬拉)/.test(content)) {
    selected.add('legs')
  }

  if (/肩|推肩|平举|肩后束|肩前束/.test(content)) {
    selected.add('shoulders')
  }

  if (/(胸|推胸|飞鸟|夹胸|上斜推)/.test(content)) {
    selected.add('chest')
  }

  if (/(背|划船|下拉|引体向上)/.test(content)) {
    selected.add('back')
  }

  if (/(有氧|跑步|骑行|椭圆机|划船机)/.test(content)) {
    selected.add('cardio')
  }

  if (selected.size === 0) {
    selected.add('chest')
  }

  return [...selected]
}

function normalizeLine(line: string) {
  return line
    .replace(/^[\s,，、:：;；]+|[\s,，、:：;；]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
