import { Request, Response } from "express";
import { PersonService } from "../services/person.service";

const personService = new PersonService()

export class PersonController {
  async getAllUsers(req: Request, res: Response) {
    try {
      const users = await personService.getAllPersons();
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar usuários" });
    }
  }
}
