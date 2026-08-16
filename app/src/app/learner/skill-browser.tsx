import { FlatStandard } from "./types";

type SkillBrowserProps = {
  activeSkill: FlatStandard | null;
  skillsByDomain: Map<string, FlatStandard[]>;
  testLocked: boolean;
  onSkillSelect: (skill: FlatStandard) => void;
};

/** Displays the selected grade's skill groups and delegates selection to the page. */
export function SkillBrowser({
  activeSkill,
  skillsByDomain,
  testLocked,
  onSkillSelect,
}: SkillBrowserProps) {
  return (
    <div className="skill-browser">
      {[...skillsByDomain.entries()].map(([domain, skills]) => (
        <div key={domain} className="browser-domain">
          <p className="browser-domain-header">{domain}</p>
          <div className="browser-skills">
            {skills.map((skill) => (
              <button
                key={skill.id}
                className={
                  activeSkill?.id === skill.id
                    ? "browser-skill active"
                    : "browser-skill"
                }
                disabled={testLocked}
                onClick={() => onSkillSelect(skill)}
              >
                <span className="browser-code">{skill.standardCode}</span>
                <span className="browser-desc">
                  {skill.standardText.length > 70
                    ? skill.standardText.slice(0, 70) + "…"
                    : skill.standardText}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
