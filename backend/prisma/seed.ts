import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type StarterControl = {
  category: string;
  code: string;
  title: string;
  description: string;
  risk: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  type?: 'EVIDENCE_BASED' | 'INFORMATIONAL';
  requirements: Array<{
    code: string;
    name: string;
    description?: string;
    type?: 'DOCUMENT' | 'SCREENSHOT' | 'REPORT' | 'LOG' | 'EXPORT' | 'ATTESTATION' | 'OTHER';
    required?: boolean;
    validityDays?: number;
  }>;
};

const controls: StarterControl[] = [
  {
    category: 'Access Control',
    code: 'AC-001',
    title: 'Authorized access',
    description: 'User access must be restricted to authorized users.',
    risk: 'HIGH',
    requirements: [
      { code: 'AC-001-REQ-1', name: 'Current user/access list', type: 'EXPORT', required: true, validityDays: 90 },
      { code: 'AC-001-REQ-2', name: 'Documented access authorization/approval', type: 'DOCUMENT', required: true },
    ],
  },
  {
    category: 'Access Control',
    code: 'AC-002',
    title: 'Quarterly access review',
    description: 'User access must be reviewed quarterly.',
    risk: 'HIGH',
    requirements: [
      { code: 'AC-002-REQ-1', name: 'Quarterly access review output', type: 'REPORT', required: true, validityDays: 120 },
    ],
  },
  {
    category: 'Access Control',
    code: 'AC-003',
    title: 'Terminated employee access removal',
    description: 'Terminated employee access must be removed promptly.',
    risk: 'HIGH',
    requirements: [
      { code: 'AC-003-REQ-1', name: 'Offboarding/access removal evidence for sampled leavers', type: 'DOCUMENT', required: true },
    ],
  },
  {
    category: 'Policy Management',
    code: 'PM-001',
    title: 'Security policies documented and approved',
    description: 'Security policies must be documented and approved.',
    risk: 'MEDIUM',
    requirements: [
      { code: 'PM-001-REQ-1', name: 'Current security policy document', type: 'DOCUMENT', required: true, validityDays: 365 },
      { code: 'PM-001-REQ-2', name: 'Approval record', type: 'ATTESTATION', required: true },
    ],
  },
  {
    category: 'Policy Management',
    code: 'PM-002',
    title: 'Policy review',
    description: 'Policies must be reviewed regularly.',
    risk: 'MEDIUM',
    requirements: [
      { code: 'PM-002-REQ-1', name: 'Policy review log or approved new version', type: 'DOCUMENT', required: true, validityDays: 365 },
    ],
  },
  {
    category: 'Incident Management',
    code: 'IM-001',
    title: 'Incident tracking and resolution',
    description: 'Security incidents must be tracked and resolved.',
    risk: 'HIGH',
    requirements: [
      { code: 'IM-001-REQ-1', name: 'Incident log', type: 'LOG', required: true },
      { code: 'IM-001-REQ-2', name: 'Postmortem or resolution evidence', type: 'DOCUMENT', required: true },
    ],
  },
  {
    category: 'Incident Management',
    code: 'IM-002',
    title: 'Incident response responsibilities',
    description: 'Incident response responsibilities must be defined.',
    risk: 'MEDIUM',
    requirements: [
      { code: 'IM-002-REQ-1', name: 'Incident response policy or responsibility matrix', type: 'DOCUMENT', required: true, validityDays: 365 },
    ],
  },
  {
    category: 'Backup Management',
    code: 'BM-001',
    title: 'Critical system backups',
    description: 'Critical systems must be backed up.',
    risk: 'HIGH',
    requirements: [
      { code: 'BM-001-REQ-1', name: 'Backup logs', type: 'LOG', required: true, validityDays: 30 },
      { code: 'BM-001-REQ-2', name: 'Backup configuration', type: 'DOCUMENT', required: true, validityDays: 365 },
    ],
  },
  {
    category: 'Backup Management',
    code: 'BM-002',
    title: 'Backup testing',
    description: 'Backups must be reviewed or tested periodically.',
    risk: 'MEDIUM',
    requirements: [
      { code: 'BM-002-REQ-1', name: 'Backup restoration/test report', type: 'REPORT', required: true, validityDays: 365 },
    ],
  },
  {
    category: 'Vendor Management',
    code: 'VM-001',
    title: 'Critical vendor review',
    description: 'Critical vendors must be reviewed.',
    risk: 'MEDIUM',
    requirements: [
      { code: 'VM-001-REQ-1', name: 'Vendor list', type: 'DOCUMENT', required: true, validityDays: 365 },
      { code: 'VM-001-REQ-2', name: 'Risk questionnaire/review', type: 'DOCUMENT', required: true, validityDays: 365 },
    ],
  },
  {
    category: 'Security Training',
    code: 'TR-001',
    title: 'Security awareness training',
    description: 'Employees must complete security awareness training.',
    risk: 'MEDIUM',
    requirements: [
      { code: 'TR-001-REQ-1', name: 'Training completion report', type: 'REPORT', required: true, validityDays: 365 },
    ],
  },
  {
    category: 'Risk Management',
    code: 'RM-001',
    title: 'Risk register',
    description: 'Security risks must be identified and tracked.',
    risk: 'HIGH',
    requirements: [{ code: 'RM-001-REQ-1', name: 'Risk register', type: 'DOCUMENT', required: true, validityDays: 180 }],
  },
  {
    category: 'Framework Information',
    code: 'INFO-001',
    title: 'Readiness guidance',
    description: 'Informational guidance for interpreting readiness results; excluded from readiness scoring.',
    risk: 'LOW',
    type: 'INFORMATIONAL',
    requirements: [],
  },
];

async function main() {
  const framework = await prisma.framework.upsert({
    where: { name: 'Security Readiness Starter Framework' },
    update: {},
    create: {
      name: 'Security Readiness Starter Framework',
      description: 'Simplified original readiness framework for the AuditFlow MVP; not an official certification framework.',
      is_template: true,
    },
  });

  const version = await prisma.frameworkVersion.upsert({
    where: { framework_id_version: { framework_id: framework.id, version: '1.0.0' } },
    update: { status: 'PUBLISHED', published_at: new Date('2026-08-08T00:00:00.000Z') },
    create: {
      framework_id: framework.id,
      version: '1.0.0',
      status: 'PUBLISHED',
      published_at: new Date('2026-08-08T00:00:00.000Z'),
    },
  });

  const categoryIds = new Map<string, string>();
  for (const [index, name] of [...new Set(controls.map((control) => control.category))].entries()) {
    const category = await prisma.controlCategory.upsert({
      where: { framework_version_id_name: { framework_version_id: version.id, name } },
      update: { sort_order: index + 1 },
      create: {
        framework_version_id: version.id,
        name,
        sort_order: index + 1,
      },
    });
    categoryIds.set(name, category.id);
  }

  for (const [index, seedControl] of controls.entries()) {
    const control = await prisma.control.upsert({
      where: { framework_version_id_code: { framework_version_id: version.id, code: seedControl.code } },
      update: {
        title: seedControl.title,
        description: seedControl.description,
        risk_level: seedControl.risk,
        control_type: seedControl.type ?? 'EVIDENCE_BASED',
        category_id: categoryIds.get(seedControl.category),
        sort_order: index + 1,
      },
      create: {
        framework_version_id: version.id,
        category_id: categoryIds.get(seedControl.category),
        code: seedControl.code,
        title: seedControl.title,
        description: seedControl.description,
        risk_level: seedControl.risk,
        control_type: seedControl.type ?? 'EVIDENCE_BASED',
        sort_order: index + 1,
      },
    });

    for (const [reqIndex, requirement] of seedControl.requirements.entries()) {
      await prisma.evidenceRequirement.upsert({
        where: { control_id_code: { control_id: control.id, code: requirement.code } },
        update: {
          name: requirement.name,
          description: requirement.description ?? null,
          requirement_type: requirement.type ?? 'DOCUMENT',
          required: requirement.required ?? true,
          validity_days: requirement.validityDays ?? null,
          sort_order: reqIndex + 1,
        },
        create: {
          control_id: control.id,
          code: requirement.code,
          name: requirement.name,
          description: requirement.description ?? null,
          requirement_type: requirement.type ?? 'DOCUMENT',
          required: requirement.required ?? true,
          validity_days: requirement.validityDays ?? null,
          sort_order: reqIndex + 1,
        },
      });
    }
  }
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
