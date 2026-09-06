import { z } from "zod";
import { staffJobGroups } from "./staff-job-groups";

const identityFields = {
  name: z.string().trim().min(2).max(120),
  email: z.email(),
  temporaryPassword: z.string().min(10).max(128),
};

export const internalUserCreateSchema = z.union([
  z.object({ ...identityFields, jobGroups: z.array(z.enum(staffJobGroups)).min(1).max(3) }).strict(),
  z.object({ ...identityFields, jobGroup: z.enum(staffJobGroups) }).strict(),
]).transform((input) => ({
  name: input.name,
  email: input.email,
  temporaryPassword: input.temporaryPassword,
  jobGroups: [...new Set("jobGroups" in input ? input.jobGroups : [input.jobGroup])],
}));
