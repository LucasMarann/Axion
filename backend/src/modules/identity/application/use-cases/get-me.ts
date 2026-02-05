export class GetMe {
  async execute() {
    // Placeholder funcional (retorna estático) apenas para validar o esqueleto HTTP do backend.
    // Na próxima etapa, ligamos auth + repos.
    return {
      user: null,
      message: "identity module ready",
    };
  }
}