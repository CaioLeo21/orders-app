import * as zod from "zod"

export const condoSchema = zod.object({
    name: zod.string({
        required_error: "Nome é obrigatório"
    }),
    responsible: zod.string(),
})
