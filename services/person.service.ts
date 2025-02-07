import { PrismaClient } from "@prisma/client";
import PersonType from "../personType.enum";
const prisma = new PrismaClient();

export class PersonService {
  async getAllPersons() {
    return await prisma.person.findMany();
  }

  async getPerson(id?: number, cpf?: string, email?: string) {
    return await prisma.person.findUnique({ where: { id_person, cpf, email } });
  }

  async createPerson(data: { name: string, type: PersonType, status: boolean, observation?: string, email?: string, phone?: string, cpf?: string }) {
    return await prisma.person.create({ data });
  }

  async updatePerson(id: number, data: { name: string, type: string, }) {
    // return await prisma.person.update({ where: { id }, data });
  }

  async deletePerson(id: number) {
    return await prisma.person.delete({ where: { id } });
  }
}
