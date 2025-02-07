import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export class DoormanService {
  async getAllDoormen() {
    return await prisma.doorman.findMany();
  }

  async getDoormen(id: number) {
    return await prisma.doorman.findUnique({ where: { id } });
  }

  async createDoormen(data: { name: string, type: string, }) {
    // return await prisma.doorman.create({ data });
  }

  async updateDoormen(id: number, data: { name: string, type: string, }) {
    // return await prisma.doorman.update({ where: { id }, data });
  }

  async deleteDoormen(id: number) {
    return await prisma.doorman.delete({ where: { id } });
  }
}
