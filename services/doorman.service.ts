import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export class DoormanService {
  async getAllDoorman() {
    return await prisma.doorman.findMany();
  }

  async getDoormanById(id: number) {
    return await prisma.doorman.findUnique({ where: { id } });
  }

  async getDoormanByName(name: string) {
    return await prisma.doorman.findFirst({ where: { name } });
  }

  async createDoorman(data: { name: string, id_condo: number }) {
    return await prisma.doorman.create({ data });
  }

  async updateDoorman(id: number, data: { name: string, type: string, }) {
    return await prisma.doorman.update({ where: { id }, data });
  }

  async deleteDoormanById(id: number) {
    return await prisma.doorman.delete({ where: { id } });
  }

  // TODO: DELETAR PELO NOME
  // async deleteDoormanByName(name: string) {
  //   return await prisma.doorman.findFirst({ where: { name } })
  //   .then(async (res: any) => {
  //     await prisma.doorman.delete({ where: { res } });
  //   })
  // }
}
