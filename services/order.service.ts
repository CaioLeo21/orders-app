import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export class OrderService {
  async getAllOrders() {
    return await prisma.order.findMany();
  }

  async getOrderById(id: number) {
    return await prisma.order.findUnique({ where: { id } });
  }

  async getOrderByDescription(description: string) {
    return await prisma.order.findFirst({ where: { description } });
  }

  // TODO Verificar como vai ficar o tipo da data
  async createOrder(data: { date: string, sender: string, type: string, description: string, id_person: number, id_doorman: number }) {
    return await prisma.order.create({ data });
  }

  async updateOrder(id: number, data: { date: string, sender: string, type: string, description: string, id_person: number, id_doorman: number }) {
    return await prisma.order.update({ where: { id }, data });
  }

  async deleteOrder(id: number) {
    return await prisma.order.delete({ where: { id } });
  }
}
