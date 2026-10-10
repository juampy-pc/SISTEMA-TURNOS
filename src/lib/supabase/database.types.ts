
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "bloqueos": {
                  Row: {
                    "desde": string,"hasta": string,"id": string,"motivo": string,"negocio_id": string,"recurso_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "desde": string,"hasta": string,"id"?: string,"motivo"?: string,"negocio_id": string,"recurso_id"?: string | null
                  }
                  Update: {
                    "desde"?: string,"hasta"?: string,"id"?: string,"motivo"?: string,"negocio_id"?: string,"recurso_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "bloqueos_negocio_id_fkey"
      columns: ["negocio_id"]
isOneToOne: false
      referencedRelation: "negocios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bloqueos_recurso_id_negocio_id_fkey"
      columns: ["recurso_id","negocio_id"]
isOneToOne: false
      referencedRelation: "recursos"
      referencedColumns: ["id","negocio_id"]
    }
                  ]
                },"clientes": {
                  Row: {
                    "created_at": string,"id": string,"negocio_id": string,"nombre": string,"notas": string,"telefono": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"negocio_id": string,"nombre": string,"notas"?: string,"telefono": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"negocio_id"?: string,"nombre"?: string,"notas"?: string,"telefono"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "clientes_negocio_id_fkey"
      columns: ["negocio_id"]
isOneToOne: false
      referencedRelation: "negocios"
      referencedColumns: ["id"]
    }
                  ]
                },"dispositivos_confiables": {
                  Row: {
                    "cliente_id": string,"confiable": boolean,"created_at": string,"id": string,"negocio_id": string,"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cliente_id": string,"confiable"?: boolean,"created_at"?: string,"id"?: string,"negocio_id": string,"token_hash": string
                  }
                  Update: {
                    "cliente_id"?: string,"confiable"?: boolean,"created_at"?: string,"id"?: string,"negocio_id"?: string,"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "dispositivos_confiables_cliente_id_negocio_id_fkey"
      columns: ["cliente_id","negocio_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id","negocio_id"]
    },{
      foreignKeyName: "dispositivos_confiables_negocio_id_fkey"
      columns: ["negocio_id"]
isOneToOne: false
      referencedRelation: "negocios"
      referencedColumns: ["id"]
    }
                  ]
                },"horarios": {
                  Row: {
                    "desde_min": number,"dia_semana": number,"hasta_min": number,"id": string,"negocio_id": string,"recurso_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "desde_min": number,"dia_semana": number,"hasta_min": number,"id"?: string,"negocio_id": string,"recurso_id": string
                  }
                  Update: {
                    "desde_min"?: number,"dia_semana"?: number,"hasta_min"?: number,"id"?: string,"negocio_id"?: string,"recurso_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "horarios_negocio_id_fkey"
      columns: ["negocio_id"]
isOneToOne: false
      referencedRelation: "negocios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "horarios_recurso_id_negocio_id_fkey"
      columns: ["recurso_id","negocio_id"]
isOneToOne: false
      referencedRelation: "recursos"
      referencedColumns: ["id","negocio_id"]
    }
                  ]
                },"miembros": {
                  Row: {
                    "activo": boolean,"auth_user_id": string,"created_at": string,"id": string,"negocio_id": string,"nombre": string,"rol_id": string,"usuario": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"auth_user_id": string,"created_at"?: string,"id"?: string,"negocio_id": string,"nombre": string,"rol_id": string,"usuario": string
                  }
                  Update: {
                    "activo"?: boolean,"auth_user_id"?: string,"created_at"?: string,"id"?: string,"negocio_id"?: string,"nombre"?: string,"rol_id"?: string,"usuario"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "miembros_negocio_id_fkey"
      columns: ["negocio_id"]
isOneToOne: false
      referencedRelation: "negocios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "miembros_rol_id_negocio_id_fkey"
      columns: ["rol_id","negocio_id"]
isOneToOne: false
      referencedRelation: "roles"
      referencedColumns: ["id","negocio_id"]
    }
                  ]
                },"negocios": {
                  Row: {
                    "anticipacion_max_dias": number,"anticipacion_min_horas": number,"created_at": string,"id": string,"intervalo_min": number,"modo_turnos": string,"nombre": string,"paso_minutos": number,"slug": string,"tipo": string,"vende_productos": boolean,"whatsapp": string,"zona_horaria": string
                  }
                  ComputedFields: never
                  Insert: {
                    "anticipacion_max_dias"?: number,"anticipacion_min_horas"?: number,"created_at"?: string,"id"?: string,"intervalo_min"?: number,"modo_turnos": string,"nombre": string,"paso_minutos"?: number,"slug": string,"tipo": string,"vende_productos"?: boolean,"whatsapp"?: string,"zona_horaria"?: string
                  }
                  Update: {
                    "anticipacion_max_dias"?: number,"anticipacion_min_horas"?: number,"created_at"?: string,"id"?: string,"intervalo_min"?: number,"modo_turnos"?: string,"nombre"?: string,"paso_minutos"?: number,"slug"?: string,"tipo"?: string,"vende_productos"?: boolean,"whatsapp"?: string,"zona_horaria"?: string
                  }
                  Relationships: [
                    
                  ]
                },"recurso_servicio": {
                  Row: {
                    "negocio_id": string,"recurso_id": string,"servicio_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "negocio_id": string,"recurso_id": string,"servicio_id": string
                  }
                  Update: {
                    "negocio_id"?: string,"recurso_id"?: string,"servicio_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recurso_servicio_negocio_id_fkey"
      columns: ["negocio_id"]
isOneToOne: false
      referencedRelation: "negocios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recurso_servicio_recurso_id_negocio_id_fkey"
      columns: ["recurso_id","negocio_id"]
isOneToOne: false
      referencedRelation: "recursos"
      referencedColumns: ["id","negocio_id"]
    },{
      foreignKeyName: "recurso_servicio_servicio_id_negocio_id_fkey"
      columns: ["servicio_id","negocio_id"]
isOneToOne: false
      referencedRelation: "servicios"
      referencedColumns: ["id","negocio_id"]
    }
                  ]
                },"recursos": {
                  Row: {
                    "activo": boolean,"created_at": string,"id": string,"miembro_id": string | null,"negocio_id": string,"nombre": string,"orden": number
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"created_at"?: string,"id"?: string,"miembro_id"?: string | null,"negocio_id": string,"nombre": string,"orden"?: number
                  }
                  Update: {
                    "activo"?: boolean,"created_at"?: string,"id"?: string,"miembro_id"?: string | null,"negocio_id"?: string,"nombre"?: string,"orden"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "recursos_miembro_id_negocio_id_fkey"
      columns: ["miembro_id","negocio_id"]
isOneToOne: false
      referencedRelation: "miembros"
      referencedColumns: ["id","negocio_id"]
    },{
      foreignKeyName: "recursos_negocio_id_fkey"
      columns: ["negocio_id"]
isOneToOne: false
      referencedRelation: "negocios"
      referencedColumns: ["id"]
    }
                  ]
                },"roles": {
                  Row: {
                    "es_dueno": boolean,"id": string,"negocio_id": string,"nombre": string,"permisos": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "es_dueno"?: boolean,"id"?: string,"negocio_id": string,"nombre": string,"permisos"?: NonNullable<Json>
                  }
                  Update: {
                    "es_dueno"?: boolean,"id"?: string,"negocio_id"?: string,"nombre"?: string,"permisos"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "roles_negocio_id_fkey"
      columns: ["negocio_id"]
isOneToOne: false
      referencedRelation: "negocios"
      referencedColumns: ["id"]
    }
                  ]
                },"servicios": {
                  Row: {
                    "activo": boolean,"created_at": string,"duracion_min": number,"id": string,"negocio_id": string,"nombre": string,"precio": number
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"created_at"?: string,"duracion_min": number,"id"?: string,"negocio_id": string,"nombre": string,"precio"?: number
                  }
                  Update: {
                    "activo"?: boolean,"created_at"?: string,"duracion_min"?: number,"id"?: string,"negocio_id"?: string,"nombre"?: string,"precio"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "servicios_negocio_id_fkey"
      columns: ["negocio_id"]
isOneToOne: false
      referencedRelation: "negocios"
      referencedColumns: ["id"]
    }
                  ]
                },"turnos": {
                  Row: {
                    "cliente_id": string,"created_at": string,"dispositivo_id": string | null,"estado": string,"fin": string,"id": string,"inicio": string,"monto_cobrado": number | null,"negocio_id": string,"nota_cliente": string,"notas": string,"recurso_id": string,"servicio_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cliente_id": string,"created_at"?: string,"dispositivo_id"?: string | null,"estado"?: string,"fin": string,"id"?: string,"inicio": string,"monto_cobrado"?: number | null,"negocio_id": string,"nota_cliente"?: string,"notas"?: string,"recurso_id": string,"servicio_id": string
                  }
                  Update: {
                    "cliente_id"?: string,"created_at"?: string,"dispositivo_id"?: string | null,"estado"?: string,"fin"?: string,"id"?: string,"inicio"?: string,"monto_cobrado"?: number | null,"negocio_id"?: string,"nota_cliente"?: string,"notas"?: string,"recurso_id"?: string,"servicio_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "turnos_cliente_id_negocio_id_fkey"
      columns: ["cliente_id","negocio_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id","negocio_id"]
    },{
      foreignKeyName: "turnos_dispositivo_id_fkey"
      columns: ["dispositivo_id"]
isOneToOne: false
      referencedRelation: "dispositivos_confiables"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "turnos_negocio_id_fkey"
      columns: ["negocio_id"]
isOneToOne: false
      referencedRelation: "negocios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "turnos_recurso_id_negocio_id_fkey"
      columns: ["recurso_id","negocio_id"]
isOneToOne: false
      referencedRelation: "recursos"
      referencedColumns: ["id","negocio_id"]
    },{
      foreignKeyName: "turnos_servicio_id_negocio_id_fkey"
      columns: ["servicio_id","negocio_id"]
isOneToOne: false
      referencedRelation: "servicios"
      referencedColumns: ["id","negocio_id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "crear_negocio":
{ Args: { "p_modo_turnos": string,"p_nombre": string,"p_nombre_dueno": string,"p_roles": Json,"p_slug": string,"p_tipo": string,"p_vende_productos": boolean }; Returns: string
                           },
"datos_dispositivo":
{ Args: { "p_negocio": string,"p_token_hash": string }; Returns: {
              "nombre": string,"telefono": string
            }[]
                           },
"huecos_disponibles":
{ Args: { "p_fecha": string,"p_recurso": string,"p_servicio": string }; Returns: {
              "fin": string,"inicio": string
            }[]
                           },
"huecos_publicos":
{ Args: { "p_fecha": string,"p_negocio": string,"p_recurso": string,"p_servicio": string }; Returns: {
              "fin": string,"inicio": string,"recurso_id": string
            }[]
                           },
"negocio_publico":
{ Args: { "p_slug": string }; Returns: Json
                           },
"reservar_publico":
{ Args: { "p_inicio": string,"p_ip": string,"p_negocio": string,"p_nombre": string,"p_nota": string,"p_recurso": string,"p_servicio": string,"p_telefono": string,"p_token_hash": string }; Returns: {
              "estado": string,"turno_id": string
            }[]
                           },
"sembrar_plantilla":
{ Args: { "p_desde_min": number,"p_dias": (number)[],"p_hasta_min": number,"p_recursos": Json,"p_servicios": Json }; Returns: undefined
                           },
"slug_disponible":
{ Args: { "p_slug": string }; Returns: boolean
                           },
"unir_clientes":
{ Args: { "p_destino": string,"p_origen": string }; Returns: undefined
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
