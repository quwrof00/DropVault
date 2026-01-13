

export type DashboardCardProps = {
    title: string;
    count: number;
    icon: string;
    color: string;
    onClick: () => void;
};

export function DashboardCard({ title, count, icon, color, onClick }: DashboardCardProps) {
    return (
        <div
            className={`bg-gradient-to-br ${color} rounded-xl p-6 shadow-lg cursor-pointer hover:shadow-xl transition-all duration-300 hover:scale-[1.02]`}
            onClick={onClick}
        >
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-gray-200 text-sm font-medium">{title}</p>
                    <p className="text-3xl font-bold mt-2">{count}</p>
                </div>
                <span className="text-4xl">{icon}</span>
            </div>
            <p className="text-gray-200 text-xs mt-4 opacity-80">View all {title.toLowerCase()}</p>
        </div>
    );
}
