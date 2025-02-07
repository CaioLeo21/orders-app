import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export class HouseService {
  async getAllHouses() {
    return await prisma.house.findMany();
  }

  async getHouse(id: number) {
    return await prisma.house.findUnique({ where: { id } });
  }

  async createHouse(data: { name: string, type: string, }) {
    // return await prisma.house.create({ data });
  }

  async updateHouse(id: number, data: { name: string, type: string, }) {
    // return await prisma.house.update({ where: { id }, data });
  }

  async deleteHouse(id: number) {
    return await prisma.house.delete({ where: { id } });
  }
}
