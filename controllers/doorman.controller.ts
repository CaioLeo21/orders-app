import { Request, Response } from "express";
import { PersonService } from "../services/person.service";
import { DoormanService } from "../services/doorman.service";

const doormanService = new DoormanService()

export class DoormanController {
  async getAllDoorman(req: Request, res: Response) {
    try {
      const users = await doormanService.getAllDoormen();
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar usuários" });
    }
  }
}
