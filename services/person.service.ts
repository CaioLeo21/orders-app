import { PrismaClient } from "@prisma/client";
import PersonType from "../personType.enum";
const prisma = new PrismaClient();

export class PersonService {
  async getAllPersons() {
    return await prisma.person.findMany();
  }

  // TODO: PEGAR ID PELO CPF OU EMAIL
  async getPersonById(id: number) {
    return await prisma.person.findUnique({ where: { id } });
  }

  async createPerson(data: { name: string, type: PersonType, status: boolean, observation?: string, email?: string, phone?: string, cpf?: string, id_house: number }) {
    return await prisma.person.create({ data });
  }

  async updatePerson(id: number, data: { name: string, type: PersonType, status: boolean, observation?: string, email?: string, phone?: string, cpf?: string, id_house: number }) {
    return await prisma.person.update({ where: { id }, data });
  }

    // TODO: DELETAR PELO CPF OU EMAIL
  async deletePersonById(id: number) {
    return await prisma.person.delete({ where: { id } });
  }
}
