import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export class OrderService {
  async getAllOrders() {
    return await prisma.oRDER.findMany();
  }

  async getOrder(id: number) {
    return await prisma.oRDER.findUnique({ where: { id } });
  }

  async createOrder(data: { name: string, type: string, }) {
    // return await prisma.oRDER.create({ data });
  }

  async updateOrder(id: number, data: { name: string, type: string, }) {
    // return await prisma.oRDER.update({ where: { id }, data });
  }

  async deleteOrder(id: number) {
    return await prisma.oRDER.delete({ where: { id } });
  }
}
