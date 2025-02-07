import express from 'express'
import { Router, Request, Response } from 'express'
import { CondoController } from '../controllers/condo.controller'

const app = express()
const condoRoutes = Router()

const condoController = new CondoController()

condoRoutes.get('/condo', async (req: Request, res: Response): Promise<any> => {
    try {
        const condos = await condoController.getAllCondos()
        return res.json(condos)
    } catch (error) {
        throw new Error('Erro ao buscar condominios')
    }
})

condoRoutes.get('/condo/:id', async (req: Request, res: Response): Promise<any> => {
    try {
        const { id } = req.params
        const condo = await condoController.getCondoByID(Number(id))
        return res.json(condo)
    } catch (error) {
        throw new Error('Erro ao buscar condominio por ID')
    }
})

condoRoutes.get('/condo/:name', async (req: Request, res: Response): Promise<any> => {
    try {
        const { name } = req.body
        const condo = await condoController.getCondoByName(name)
        return res.json(condo)
    } catch (error) {
        throw new Error('Erro ao buscar condominio por ID')
    }
})

condoRoutes.post('/condo', async (req: Request, res: Response): Promise<any> => {
    try {
        const condo = await condoController.createCondo(req.body)
        return res.json(condo)
    } catch (error) {
        console.error("🚀 ~ condoRoutes.post ~ error:", error)
        throw new Error('Erro ao cadastrar condominio')
    }
})

condoRoutes.put('/condo/:id', async (req: Request, res: Response): Promise<any> => {
    try {
        const { id } = req.params
        const condo = await condoController.updateCondo(Number(id), req.body)
        return res.json(condo)
    } catch (error) {
        console.error("🚀 ~ condoRoutes.put ~ error:", error)
        throw new Error('Erro ao atualizar condominio')
    }
})

condoRoutes.delete('/condo/:id', async (req: Request, res: Response): Promise<any> => {
    try {
        const { id } = req.params
        const condo = await condoController.deleteCondoByID(Number(id))
        return res.json(condo)
    } catch (error) {
        throw new Error('Erro ao excluir condominio por ID')
    }
})

condoRoutes.delete('/condo', async (req: Request, res: Response): Promise<any> => {
    try {
        const { name } = req.body 
        const condo = await condoController.deleteCondoByName(name)
        return res.json(condo)
    } catch (error) {
        throw new Error('Erro ao excluir condominio por nome')
    }
})

export default condoRoutes