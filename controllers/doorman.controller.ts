import { Request, Response } from "express";
import { PersonService } from "../services/person.service";
import { DoormanService } from "../services/doorman.service";

const doormanService = new DoormanService()

export class DoormanController {
  async getAllDoorman(req: Request, res: Response) {
    try {
      const allDoorman = await doormanService.getAllDoorman();
      return res.json(allDoorman);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar porteiros!" });
    }
  }

  async getDoormanById(id: number, req: Request, res: Response) {
    try {
      const doormanByID = await doormanService.getDoormanById(id);
      return res.json(doormanByID);
    } catch (error) {
      return res.status(500).json({ message: "Erro ao buscar porteiro pelo ID!" });
    }
  }

  async getDoormanByName(name: string, req: Request, res: Response) {
    try {
      const doormanByName = await doormanService.getDoormanByName(name);
      return res.json(doormanByName);
    } catch (error) {
      return res.status(500).json({ message: "Erro ao buscar porteiro pelo nome!" });
    }
  }

  async createDoorman(data: { name: string, id_condo: number }, req: Request, res: Response) {
    try {
      const doorman = await doormanService.createDoorman(data);
      return res.json(doorman);
    } catch (error) {
      return res.status(500).json({ message: "Erro ao adicionar um porteiro!" });
    }
  }

  async updateDoorman(id: number, data: { name: string, type: string, }, req: Request, res: Response) {
    try {
      const doorman = await doormanService.updateDoorman(id, data);
      return res.json(doorman);
    } catch (error) {
      return res.status(500).json({ message: "Erro ao atualizar porteiros" });
    }
  }

  async deleteDoormanById(id: number, req: Request, res: Response) {
    try {
      const users = await doormanService.deleteDoormanById(id);
      return res.json(users);
    } catch (error) {
      return res.status(500).json({ message: "Erro ao excluir porteiros!" });
    }
  }
}
