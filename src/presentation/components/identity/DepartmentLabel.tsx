// A department at a level, with the tenant's own label for the level. If the department list or the
// labels did not load, the row still shows "Department" and the level's plain name (spec UX-13).
//
// Replaced by the shared identity package's label (LLD §15 #5).
import { useT } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import type { DepartmentLevel } from '../../../domain/vocabulary'
import { APP_ID } from '../../../shared/constants/app'
import type { DepartmentDirectory } from '../../features/identity/useDepartmentDirectory'

const LEVEL_KEYS = {
  preparator: 'identity.level.preparator',
  reviewer: 'identity.level.reviewer',
  approver: 'identity.level.approver',
} as const satisfies Record<DepartmentLevel, string>

/** The text of a level: the tenant's label, else the level's own name. */
export function useLevelText(directory: Pick<DepartmentDirectory, 'levelLabel'>): (level: DepartmentLevel) => string {
  const t = useT(APP_ID)
  return (level) => directory.levelLabel(level) ?? t(LEVEL_KEYS[level])
}

export default function DepartmentLabel({ departmentId, level, directory }: { departmentId: string; level: DepartmentLevel; directory: DepartmentDirectory }) {
  const t = useT(APP_ID)
  const levelText = useLevelText(directory)
  return (
    <span>
      {directory.nameOf(departmentId) ?? t('identity.department')} · {levelText(level)}
    </span>
  )
}
