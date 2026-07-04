import { useEffect } from "react";
import { useRecoilState } from "recoil";
import { workspacestate } from "@/state";

interface ChangelogEntry {
  title: string;
  pubDate: string;
  content: string;
  version: string | null;
}

const PREFIX = "_changelog_";

interface NewFeaturesProps {
  onReady?: () => void;
}

const newFeatures = ({ onReady }: NewFeaturesProps = {}) => {
  const [workspace] = useRecoilState(workspacestate);

  useEffect(() => {
    if (!workspace.groupId) {
      onReady?.();
      return;
    }

    const fetchAndPostNotification = async () => {
      try {
        const res = await fetch("/api/changelog");
        const data: ChangelogEntry[] = await res.json();
        const currentVersion = process.env.NEXT_PUBLIC_APP_VERSION;

        if (data && data.length > 0) {
          const latest = currentVersion
            ? (data.find((entry) => entry.version === currentVersion) ?? null)
            : data[0];

          if (!latest) {
            onReady?.();
            return;
          }

          const entryKey = `${PREFIX}${latest.title}`;
          const hasSeen = localStorage.getItem(entryKey);

          if (!hasSeen) {
            localStorage.setItem(entryKey, "true");
            await fetch(`/api/workspace/${workspace.groupId}/notifications`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: "changelog",
                title: `What's New: ${latest.title}`,
                body: latest.content.slice(0, 200).replace(/[#*`]/g, "").trim() || "A new update is available.",
                href: "https://feedback.firefli.net/changelog",
              }),
            });
          }
        }
      } catch (error) {
        console.error("Failed to post changelog notification:", error);
      } finally {
        onReady?.();
      }
    };

    fetchAndPostNotification();
  }, [workspace.groupId]);

  return null;
};

export default newFeatures;
