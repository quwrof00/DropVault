const assignedColors = new Map<string, number>();
let nextColorIndex = 0;

export const getUserColorClasses = (identifier: string) => {
    if (assignedColors.has(identifier)) {
        return colors[assignedColors.get(identifier)!];
    }
    const index = nextColorIndex % colors.length;
    assignedColors.set(identifier, index);
    nextColorIndex++;
    return colors[index];
};

const colors = [
    { bg: "bg-red-500", text: "text-red-500", border: "border-red-500/20", bgSoft: "bg-red-500/20" },
    { bg: "bg-orange-500", text: "text-orange-500", border: "border-orange-500/20", bgSoft: "bg-orange-500/20" },
    { bg: "bg-amber-500", text: "text-amber-500", border: "border-amber-500/20", bgSoft: "bg-amber-500/20" },
    { bg: "bg-green-500", text: "text-green-500", border: "border-green-500/20", bgSoft: "bg-green-500/20" },
    { bg: "bg-emerald-500", text: "text-emerald-500", border: "border-emerald-500/20", bgSoft: "bg-emerald-500/20" },
    { bg: "bg-teal-500", text: "text-teal-500", border: "border-teal-500/20", bgSoft: "bg-teal-500/20" },
    { bg: "bg-cyan-500", text: "text-cyan-500", border: "border-cyan-500/20", bgSoft: "bg-cyan-500/20" },
    { bg: "bg-sky-500", text: "text-sky-500", border: "border-sky-500/20", bgSoft: "bg-sky-500/20" },
    { bg: "bg-blue-500", text: "text-blue-500", border: "border-blue-500/20", bgSoft: "bg-blue-500/20" },
    { bg: "bg-indigo-500", text: "text-indigo-500", border: "border-indigo-500/20", bgSoft: "bg-indigo-500/20" },
    { bg: "bg-violet-500", text: "text-violet-500", border: "border-violet-500/20", bgSoft: "bg-violet-500/20" },
    { bg: "bg-purple-500", text: "text-purple-500", border: "border-purple-500/20", bgSoft: "bg-purple-500/20" },
    { bg: "bg-fuchsia-500", text: "text-fuchsia-500", border: "border-fuchsia-500/20", bgSoft: "bg-fuchsia-500/20" },
    { bg: "bg-pink-500", text: "text-pink-500", border: "border-pink-500/20", bgSoft: "bg-pink-500/20" },
    { bg: "bg-rose-500", text: "text-rose-500", border: "border-rose-500/20", bgSoft: "bg-rose-500/20" },
];
