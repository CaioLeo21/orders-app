import { PrismaClient } from "@prisma/client";
import { condoSchema } from "../schemas";
const prisma = new PrismaClient();

export class CondoService {
  async getAllCondos() {
    return await prisma.condo.findMany()
  }

  async getCondoByID(id: number) {
    return await prisma.condo.findFirst({ where: { id } })
  }

  async getCondoByName(name: string) {
    return await prisma.condo.findFirst({ where: { name } })
  }
  
  async createCondo(data: { name: string, responsible?: string }) {
    const validatedData = condoSchema.parse(data)
    
    return await prisma.condo.create({ data: validatedData })
  }

  async updateCondo(data: { name?: string, responsible?: string, }) {
    const validatedData = condoSchema.parse(data)
    
    return await prisma.condo.create({ data: validatedData })
  }

  async deleteCondoByID(id: number) {
    return await prisma.condo.delete({ where: { id } });
  }

  async deleteCondoByName(name: string) {
    return await prisma.condo.delete({ where: { name } });
  }
}
