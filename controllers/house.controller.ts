import { Request, Response } from "express";
import { HouseService } from "../services/house.service";

const houseService = new HouseService()

export class HouseController {
  async getAllCondominiuns(req: Request, res: Response) {
    try {
      const users = await houseService.getAllHouses();
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar usuários" });
    }
  }
}

