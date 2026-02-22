function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export interface ReportTabOption {
  id: string;
  label: string;
}

interface ReportTabsProps {
  tabs: ReportTabOption[];
  activeTab: string;
  onChange: (tabId: string) => void;
}

export default function ReportTabs({
  tabs,
  activeTab,
  onChange,
}: ReportTabsProps) {
  return (
    <div className="rounded-2xl border bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const selected = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={cx(
                'rounded-xl px-3 py-2 text-sm font-medium transition',
                selected
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
