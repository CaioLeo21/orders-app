import { CondoService } from "../services/condo.service";

const condoService = new CondoService()

export class CondoController {
  async getAllCondos() {
    return await condoService.getAllCondos();
  }

  async getCondoByName(name: string) {
      return await condoService.getCondoByName(name);
  }

  async getCondoByID(id: number) {
    return await condoService.getCondoByID(Number(id));
  }

  async createCondo(data: { name: string, responsible?: string }) {
    return await condoService.createCondo(data);
  }

  async updateCondo(id: number, data: { name: string, responsible?: string }) {
    return await condoService.updateCondo(id, data);
  }
  
  async deleteCondoByID(id: number) {
      return await condoService.deleteCondoByID(Number(id));
  }
  
  async deleteCondoByName(name: string) {
    return await condoService.deleteCondoByName(name);
  }
}

