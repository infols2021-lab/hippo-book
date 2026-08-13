import {
  ROADMAP_PACK_FORMAT,
  ROADMAP_PACK_VERSION,
  type RoadmapImportPack,
  type RoadmapNodeDef,
} from "@/lib/roadmap/types";

function stubQuestion(index: number, lessonTitle: string) {
  const id = `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
  return {
    id,
    type: "test" as const,
    q: `${lessonTitle}: выберите правильный ответ (${index % 3 + 1}/3)`,
    explanation: `Правильный ответ относится к теме «${lessonTitle}».`,
    multiple: false,
    options: [
      { id: `o-${index}-a`, text: "Вариант A", media: [] },
      { id: `o-${index}-b`, text: "Вариант B", media: [] },
      { id: `o-${index}-c`, text: "Вариант C", media: [] },
    ],
    correct: [0],
  };
}

function lessonNode(id: string, title: string, questionOffset: number): RoadmapNodeDef {
  return {
    id,
    type: "lesson",
    title,
    assignment: {
      title,
      assignment_type: "test",
      content: {
        mode: "interactive",
        questions: [
          stubQuestion(questionOffset, title),
          stubQuestion(questionOffset + 1, title),
          stubQuestion(questionOffset + 2, title),
        ],
      },
    },
  };
}

function examQuestions(count: number, prefix: string) {
  return Array.from({ length: count }, (_, index) => stubQuestion(9000 + index, `${prefix} — вопрос ${index + 1}`));
}

function blockSegment(
  id: string,
  title: string,
  starsRequired: number,
  lessons: Array<{ id: string; title: string }>,
  questionOffset: number,
) {
  let offset = questionOffset;
  const nodes = lessons.map((lesson) => {
    const node = lessonNode(lesson.id, lesson.title, offset);
    offset += 3;
    return node;
  });

  return {
    kind: "block" as const,
    id,
    title,
    stars_required: starsRequired,
    nodes,
  };
}

function examSegment(
  id: string,
  title: string,
  nodeId: string,
  timeLimitSec: number,
  passPercent: number,
  questionCount: number,
) {
  return {
    kind: "exam" as const,
    id,
    title,
    node: {
      id: nodeId,
      type: "exam" as const,
      title,
      exam: {
        time_limit_sec: timeLimitSec,
        pass_percent: passPercent,
        unlimited_attempts: true,
      },
      assignment: {
        title,
        assignment_type: "test" as const,
        content: {
          mode: "interactive",
          questions: examQuestions(questionCount, title),
        },
      },
    },
  };
}

export function buildCourse30Template(): RoadmapImportPack {
  const block1Lessons = Array.from({ length: 5 }, (_, index) => ({
    id: `b1-l${index + 1}`,
    title: `Урок ${index + 1}`,
  }));

  const block2Lessons = Array.from({ length: 7 }, (_, index) => ({
    id: `b2-l${index + 1}`,
    title: `Урок ${index + 6}`,
  }));

  const block3Lessons = Array.from({ length: 8 }, (_, index) => ({
    id: `b3-l${index + 1}`,
    title: `Урок ${index + 13}`,
  }));

  const block4Lessons = Array.from({ length: 10 }, (_, index) => ({
    id: `b4-l${index + 1}`,
    title: `Урок ${index + 21}`,
  }));

  return {
    format: ROADMAP_PACK_FORMAT,
    version: ROADMAP_PACK_VERSION,
    title: "Полный roadmap-курс",
    description: "30 уроков, 4 блока, 2 промежуточных экзамена, финальный экзамен и сертификат",
    material: {
      title: "Roadmap-курс (30 заданий)",
      description: "Шаблон: 4 блока, экзамены, сертификат",
    },
    segments: [
      blockSegment("block-1", "Блок 1. Базовый уровень", 12, block1Lessons, 1),
      blockSegment("block-2", "Блок 2. Развитие навыков", 16, block2Lessons, 16),
      examSegment("exam-1", "Экзамен 1", "exam-1-node", 480, 80, 8),
      blockSegment("block-3", "Блок 3. Углубление", 19, block3Lessons, 37),
      examSegment("exam-2", "Экзамен 2", "exam-2-node", 600, 85, 10),
      blockSegment("block-4", "Блок 4. Финальный блок", 24, block4Lessons, 61),
      examSegment("exam-final", "Финальный экзамен", "exam-final-node", 600, 90, 12),
      {
        kind: "certificate",
        id: "certificate",
        title: "Сертификат",
        enabled: true,
      },
    ],
  };
}
