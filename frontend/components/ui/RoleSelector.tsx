import { useI18n } from "@/app/i18n";

export type RoleSelectorProps = {
  value: "employee" | "admin";
  onChange: (role: "employee" | "admin") => void;
};

const active =
  "border-indigo-600 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300 dark:ring-indigo-500";
const idle =
  "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800";

/** Two-way employee/admin selector used on the user create/edit forms. */
export default function RoleSelector({ value, onChange }: RoleSelectorProps) {
  const { t } = useI18n();

  const Option = ({ role }: { role: "employee" | "admin" }) => (
    <button
      type="button"
      onClick={() => onChange(role)}
      className={`flex flex-col items-center justify-center rounded-xl border p-3 text-sm font-medium transition-all ${
        value === role ? active : idle
      }`}
    >
      {t(`admin.form.role.${role}`)}
    </button>
  );

  return (
    <div className="grid grid-cols-2 gap-3">
      <Option role="employee" />
      <Option role="admin" />
    </div>
  );
}