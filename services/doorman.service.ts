import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export class DoormanService {
  async getAllDoormen() {
    return await prisma.doorman.findMany();
  }

  async getDoormenById(id: number) {
    return await prisma.doorman.findUnique({ where: { id } });
  }

  async getDoormenByName(name: string) {
    return await prisma.doorman.findFirst({ where: { name } });
  }

  async createDoormen(data: { name: string, id_condo: number }) {
    return await prisma.doorman.create({ data });
  }

  async updateDoormen(id: number, data: { name: string, type: string, }) {
    return await prisma.doorman.update({ where: { id }, data });
  }

  async deleteDoormenById(id: number) {
    return await prisma.doorman.delete({ where: { id } });
  }

  // async deleteDoormenByName(name: string) {
  //   return await prisma.doorman.findFirst({ where: { name } })
  //   .then(async (res: any) => {
  //     await prisma.doorman.delete({ where: { res } });
  //   })
  // }
}
