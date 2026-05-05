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
    <main className="gatehouse-page">
      <div className="gatehouse-container">
        <GatehouseHeader
          title={title}
          description={description}
          backHref="/gatehouse/materials"
          backLabel="Материалы"
        />

        <section className="gatehouse-profile">
          <div className="gatehouse-card">
            <div className="gatehouse-card__inner">
              <div className="gatehouse-empty">
                <span className="gatehouse-empty__icon" aria-hidden="true">
                  📝
                </span>
                <h3 className="gatehouse-empty__title">{title}</h3>
                <p className="gatehouse-empty__text">{description}</p>

                <div style={{ marginTop: 18 }}>
                  <Link className="gatehouse-button" href={actionHref}>
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
        actionLabel="Создать заявку"
      />
    );
  }

  return <AssignmentClient assignmentId={assignmentId} source="gatehouse-material" sourceId={materialId} />;
}