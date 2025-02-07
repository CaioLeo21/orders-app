import { Request, Response } from "express";
import { OrderService } from "../services/order.service";

const orderService = new OrderService()

export class OrderController {
  async getAllUsers(req: Request, res: Response) {
    try {
      const users = await orderService.getAllOrders();
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar usuários" });
    }
  }
}
