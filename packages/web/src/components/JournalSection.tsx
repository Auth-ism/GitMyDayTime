import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Check } from "lucide-react";
import { api } from "@/lib/api";

interface Props {
  date: string;
}

export default function JournalSection({ date }: Props) {
  const qc = useQueryClient();
  const key = ["journal", date];

  const { data } = useQuery({
    queryKey: key,
    queryFn: () => api.getJournal(date),
  });

  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (data?.content !== undefined) {
      setValue(data.content);
    }
  }, [data?.content]);

  const save = useMutation({
    mutationFn: (content: string) => api.updateJournal(date, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    },
  });

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const v = e.target.value;
      setValue(v);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        save.mutate(v);
      }, 1000);
    },
    [save]
  );

  const handleBlur = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (value !== (data?.content ?? "")) {
      save.mutate(value);
    }
  }, [value, data?.content, save]);

  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;

  return (
    <section className="card space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen size={15} className="text-text-tertiary" />
          <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider">
            Gunluk
          </span>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1 text-xs text-success">
              <Check size={11} />
              Kaydedildi
            </span>
          )}
          <span className="text-xs text-text-tertiary">{wordCount} kelime</span>
        </div>
      </div>
      <textarea
        className="input resize-none w-full text-sm leading-relaxed"
        rows={4}
        placeholder="Bugunu nasil gecirdin? Dusuncelerini yaz..."
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
      />
    </section>
  );
}
