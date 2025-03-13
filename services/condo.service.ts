import { PrismaClient } from "@prisma/client";
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
    return await prisma.condo.create({ data })
  }

  async updateCondo(id: number, data: { name?: string, responsible?: string }) {
    return await prisma.condo.update({ where: { id }, data })
  }

  async deleteCondoByID(id: number) {
    return await prisma.condo.delete({ where: { id } });
  }

  async deleteCondoByName(name: string) {
    return await prisma.condo.delete({ where: { name } });
  }
}
