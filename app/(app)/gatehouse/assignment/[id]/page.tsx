// app/(app)/gatehouse/assignment/[id]/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import GatehouseHeader from "@/components/gatehouse/GatehouseHeader";
import AssignmentClient from "../../../assignment/AssignmentClient";

type MaybePromise<T> = T | Promise<T>;

type AssignmentMaterialRow = {
  id: string;
  title: string;
  branch_type: string | null;
  material_kind: string | null;
  is_active: boolean | null;
  is_available: boolean | null;
};

type AssignmentRow = {
  id: string;
  title: string;
  branch_type: string | null;
  material_id: string | null;
  textbook_id?: string | null;
  crossword_id?: string | null;
  materials?: AssignmentMaterialRow | AssignmentMaterialRow[] | null;
};

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function normalizeAssignmentRow(value: any): AssignmentRow {
  const material = firstOrNull(value?.materials);

  return {
    id: String(value?.id ?? ""),
    title: String(value?.title ?? ""),
    branch_type: typeof value?.branch_type === "string" ? value.branch_type : null,
    material_id: typeof value?.material_id === "string" ? value.material_id : null,
    textbook_id: typeof value?.textbook_id === "string" ? value.textbook_id : null,
    crossword_id: typeof value?.crossword_id === "string" ? value.crossword_id : null,
    materials: material
      ? {
          id: String((material as any)?.id ?? ""),
          title: String((material as any)?.title ?? ""),
          branch_type:
            typeof (material as any)?.branch_type === "string" ? (material as any).branch_type : null,
          material_kind:
            typeof (material as any)?.material_kind === "string"
              ? (material as any).material_kind
              : null,
          is_active:
            typeof (material as any)?.is_active === "boolean" ? (material as any).is_active : null,
          is_available:
            typeof (material as any)?.is_available === "boolean"
              ? (material as any).is_available
              : null,
        }
      : null,
  };
}

function ErrorState({
  title,
  description,
  actionHref = "/gatehouse/materials",
  actionLabel = "Вернуться к материалам",
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <main className="gatehouse-page" style={{ minHeight: '100vh', padding: '24px 0', background: 'linear-gradient(135deg, #0f172a, #1e1b4b)', color: '#f8fafc' }}>
      <div className="gatehouse-container" style={{ width: '95%', maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* НОВЫЙ ЕДИНЫЙ ХЕДЕР БЕЗ ПРОПСОВ */}
        <GatehouseHeader />

        {/* ЗАГОЛОВОК СТРАНИЦЫ ОШИБКИ */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'inline-block', padding: '6px 12px', background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', borderRadius: '8px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '1px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            Внимание
          </div>
          <h1 style={{ margin: '0 0 12px 0', fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 950, letterSpacing: '-0.04em', color: '#f8fafc' }}>
            {title}
          </h1>
        </div>

        <section className="gatehouse-profile">
          <div className="gatehouse-card" style={{ background: 'rgba(30, 41, 59, 0.6)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '22px' }}>
            <div className="gatehouse-card__inner">
              <div className="gatehouse-empty" style={{ background: 'transparent', border: 'none', padding: '40px 20px' }}>
                <span className="gatehouse-empty__icon" aria-hidden="true" style={{ fontSize: '48px', opacity: 0.8, marginBottom: '16px' }}>
                  📝
                </span>

                <p className="gatehouse-empty__text" style={{ fontSize: '16px', color: '#94a3b8', maxWidth: '500px', margin: '0 auto 24px', lineHeight: 1.6 }}>{description}</p>

                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <Link href={actionHref} style={{ display: 'inline-block', padding: '12px 24px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', borderRadius: '12px', textDecoration: 'none', fontWeight: 800, fontSize: '15px', boxShadow: '0 8px 20px rgba(99,102,241,0.25)' }}>
                    {actionLabel}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default async function GatehouseAssignmentByIdPage({
  params,
}: {
  params: MaybePromise<{ id: string }>;
}) {
  const { id } = await params;
  const assignmentId = String(id ?? "").trim();

  if (!assignmentId) {
    redirect("/gatehouse/materials");
  }

  const supabase = await createSupabaseServerClient();

  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) {
    redirect("/login");
  }

  const { data: assignment, error } = await supabase
    .from("assignments")
    .select(
      `
      id,
      title,
      branch_type,
      material_id,
      textbook_id,
      crossword_id,
      materials(
        id,
        title,
        branch_type,
        material_kind,
        is_active,
        is_available
      )
    `,
    )
    .eq("id", assignmentId)
    .single();

  if (error || !assignment) {
    return (
      <ErrorState
        title="Задание не найдено"
        description={error?.message || "Не удалось открыть это задание Gatehouse Awards."}
      />
    );
  }

  const row = normalizeAssignmentRow(assignment);
  const material = firstOrNull(row.materials);
  const materialId = row.material_id ?? material?.id ?? null;

  if (row.branch_type !== "gatehouse" && material?.branch_type !== "gatehouse") {
    return (
      <ErrorState
        title="Это не экзаменационное задание"
        description="Задание относится к другому разделу платформы."
        actionHref="/portal"
        actionLabel="Вернуться в портал"
      />
    );
  }

  if (!materialId) {
    return (
      <ErrorState
        title="Материал задания не найден"
        description="У задания нет связанного материала Gatehouse Awards."
      />
    );
  }

  if (material && material.is_active === false) {
    return (
      <ErrorState
        title="Материал отключён"
        description="Этот пробный тест Gatehouse Awards сейчас недоступен."
      />
    );
  }

  const { data: access } = await supabase
    .from("material_access")
    .select("id")
    .eq("user_id", user.id)
    .eq("material_id", materialId)
    .maybeSingle();

  const hasAccess = Boolean(material?.is_available || access);

  if (!hasAccess) {
    return (
      <ErrorState
        title="Задание пока закрыто"
        description="Чтобы пройти это задание, нужно получить доступ к пробному тесту через заявку."
        actionHref="/gatehouse/requests"
        actionLabel="Перейти к заявкам"
      />
    );
  }

  // Если всё ок, рендерим сам клиент задания
  return <AssignmentClient assignmentId={assignmentId} source="gatehouse-material" sourceId={materialId} />;
}