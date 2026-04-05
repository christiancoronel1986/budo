import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

function App() {
  // --------- ESTADOS COMPARTIDOS ---------
  const [currentStep, setCurrentStep] = useState(1)
  const [status, setStatus] = useState({ type: '', message: '' })
  const [isSuccess, setIsSuccess] = useState(false)
  const [isPrintMode, setIsPrintMode] = useState(false)
  const [isResultMode, setIsResultMode] = useState(false)
  const [printDesign, setPrintDesign] = useState(1)
  const [savedEventId, setSavedEventId] = useState(null) // ID del evento guardado actualmente

  // --------- ESTADOS STEP 1: EVENTO ---------
  const [formData, setFormData] = useState({
    nombre_evento: '',
    numero_evento: '',
    disciplina: '',
    fecha: '2026-04-04',
    ciudad: ''
  })
  
  // Híbrido de Logo 1
  const [logoMode, setLogoMode] = useState('url') // 'url' or 'file'
  const [logoFile, setLogoFile] = useState(null)
  const [logoUrlInput, setLogoUrlInput] = useState('')
  
  // Híbrido de Logo 2
  const [logo2Mode, setLogo2Mode] = useState('url')
  const [logo2File, setLogo2File] = useState(null)
  const [logo2UrlInput, setLogo2UrlInput] = useState('')
  
  // Lista dinámica de categorías creadas por el usuario en el Paso 1
  const [categorias, setCategorias] = useState([
    { id: Date.now(), tipo: '', cant: 1 }
  ])

  const [ciudades, setCiudades] = useState([])
  const [nombresEventos, setNombresEventos] = useState([])

  const [isAddingNombre, setIsAddingNombre] = useState(false)
  const [isDeletingNombre, setIsDeletingNombre] = useState(false)
  const [nuevoNombreInput, setNuevoNombreInput] = useState('')
  const [isSavingNombre, setIsSavingNombre] = useState(false)

  const [isAddingCiudad, setIsAddingCiudad] = useState(false)
  const [isDeletingCiudad, setIsDeletingCiudad] = useState(false)
  const [nuevaCiudadInput, setNuevaCiudadInput] = useState('')
  const [isSavingCiudad, setIsSavingCiudad] = useState(false)

  // --------- ESTADOS WIZARD PELEADORES (Pasos 2 al N) ---------
  // Array matriz de datos. Cada posición contiene el array de peleas de una categoría particular.
  const [fightFormsData, setFightFormsData] = useState([])


  // --------- EFECTOS DE MONTAJE ---------
  useEffect(() => {
    fetchCiudades()
    fetchNombresEventos()

    // Detectar si la sesión anterior se cerró sin limpiar (cierre de tab/navegador)
    // sessionStorage sobrevive refresh pero se limpia al cerrar el tab
    const wasRefreshed = sessionStorage.getItem('activeSession')
    const pendingCleanup = localStorage.getItem('pendingCleanupEventId')

    if (pendingCleanup && !wasRefreshed) {
      // El tab fue cerrado y reabierto → limpiar
      cleanupEvento(parseInt(pendingCleanup)).then(() => {
        localStorage.removeItem('pendingCleanupEventId')
      })
    } else if (pendingCleanup && wasRefreshed) {
      // Fue un refresh → no borrar, solo recargar
      localStorage.removeItem('pendingCleanupEventId')
    }

    // Marcar sesión activa (se borra a al cerrar el tab)
    sessionStorage.setItem('activeSession', 'true')
  }, [])

  // Guardar evento ID para limpieza si el navegador se cierra
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (savedEventId) {
        localStorage.setItem('pendingCleanupEventId', savedEventId.toString())
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [savedEventId])

  const fetchCiudades = async () => {
    try {
      const { data, error } = await supabase.from('ciudades').select('*').order('nombre')
      if (error) throw error
      if (data) setCiudades(data)
    } catch (err) { console.error('Error:', err) }
  }

  const fetchNombresEventos = async () => {
    try {
      const { data, error } = await supabase.from('nombres_eventos').select('*').order('nombre')
      if (error) throw error
      if (data) setNombresEventos(data)
    } catch (err) { console.error('Error:', err) }
  }

  // --------- MANEJO CATÁLOGOS ---------
  const handleSaveNuevoNombre = async () => {
    if (!nuevoNombreInput.trim()) return
    setIsSavingNombre(true)
    try {
      const { error } = await supabase.from('nombres_eventos').insert([{ nombre: nuevoNombreInput.trim() }])
      if (error) throw error
      await fetchNombresEventos()
      setFormData(prev => ({ ...prev, nombre_evento: nuevoNombreInput.trim() }))
      setNuevoNombreInput(''); setIsAddingNombre(false)
    } catch (err) { alert('Hubo un error al guardar.') } finally { setIsSavingNombre(false) }
  }

  const executeDeleteNombre = async (nombreABorrar) => {
    if (!nombreABorrar) return
    if (!window.confirm(`¿Seguro que quieres eliminar "${nombreABorrar}" permanentemente?`)) return
    try {
      const { error } = await supabase.from('nombres_eventos').delete().eq('nombre', nombreABorrar)
      if (error) throw error
      if (formData.nombre_evento === nombreABorrar) { setFormData(prev => ({ ...prev, nombre_evento: '' })) }
      await fetchNombresEventos()
      setIsDeletingNombre(false)
    } catch (err) { alert('Hubo un error al eliminar.') }
  }

  const handleSaveNuevaCiudad = async () => {
    if (!nuevaCiudadInput.trim()) return
    setIsSavingCiudad(true)
    try {
      const { error } = await supabase.from('ciudades').insert([{ nombre: nuevaCiudadInput.trim() }])
      if (error) throw error
      await fetchCiudades()
      setFormData(prev => ({ ...prev, ciudad: nuevaCiudadInput.trim() }))
      setNuevaCiudadInput(''); setIsAddingCiudad(false)
    } catch (err) { alert('Hubo un error al guardar.') } finally { setIsSavingCiudad(false) }
  }

  const executeDeleteCiudad = async (ciudadABorrar) => {
    if (!ciudadABorrar) return
    if (!window.confirm(`¿Seguro que quieres eliminar "${ciudadABorrar}" permanentemente?`)) return
    try {
      const { error } = await supabase.from('ciudades').delete().eq('nombre', ciudadABorrar)
      if (error) throw error
      if (formData.ciudad === ciudadABorrar) { setFormData(prev => ({ ...prev, ciudad: '' })) }
      await fetchCiudades()
      setIsDeletingCiudad(false)
    } catch (err) { alert('Hubo un error al eliminar.') }
  }


  // --------- LOGICA WIZARD DINAMICO ---------
  const handleChange1 = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  // Lógica de Categorías Step 1
  const agregarCategoria = () => setCategorias([...categorias, { id: Date.now(), tipo: '', cant: 1 }])
  const removeCategoria = (idx) => setCategorias(categorias.filter((_, i) => i !== idx))
  const updateCategoria = (idx, field, val) => {
    const newCats = [...categorias]
    newCats[idx][field] = val
    setCategorias(newCats)
  }

  const proceedFromStep1 = (e) => {
    e.preventDefault()

    const categoriasValidas = categorias.filter(c => c.tipo.trim() !== '' && parseInt(c.cant) > 0);
    if(categoriasValidas.length === 0){
        alert("Por favor, llena correctamente al menos una Categoría de Pelea con valores válidos.");
        return;
    }

    // Estrategia de conservación de memoria si el usuario clickea Atraás/Adelante
    const newFightData = categoriasValidas.map((cat) => {
       const grupoExistente = fightFormsData.find(grupo => grupo.length > 0 && grupo[0].tipo_pelea.trim() === cat.tipo.trim());
       const cantidad = parseInt(cat.cant);

       if (grupoExistente) {
           const clon = [...grupoExistente];
           // Añadir campos vacios si el usuario incrementó la cantidad
           while(clon.length < cantidad){
              clon.push({ tipo_pelea: cat.tipo.trim(), rojo_nombre: '', rojo_apodo: '', rojo_apellido: '', azul_nombre: '', azul_apodo: '', azul_apellido: '' });
           }
           clon.forEach(f => f.tipo_pelea = cat.tipo.trim()); // Por si hubo cambios leves de case
           return clon.slice(0, cantidad); // Rebanar si el usuario bajó la cantidad
       } else {
           // Grupo enteramente nuevo
           return Array.from({length: cantidad}, () => ({
              tipo_pelea: cat.tipo.trim(),
              rojo_nombre: '', rojo_apodo: '', rojo_apellido: '', azul_nombre: '', azul_apodo: '', azul_apellido: ''
          }))
       }
    });

    setFightFormsData(newFightData)
    setCurrentStep(2) // Siempre avanza al paso 2, indexArray => 0
  }

  const handleVolverAPasoAnterior = () => {
    setCurrentStep(prev => prev - 1)
  }

  const proceedNextCategoryOrSave = (e) => {
    e.preventDefault()
    
    // Si terminamos las iteraciones normales de categorias, pasamos a la PANTALLA EXCLUSIVA DE RESUMEN
    // Sabemos esto porque totalPasosNormales = 1 (Paso 1) + categoriasValidas.length
    const totalPasosExisten = fightFormsData.length + 1;
    
    if (currentStep <= totalPasosExisten) {
      setCurrentStep(prev => prev + 1)
    }
  }


  // --------- MANEJADORES DE PELEADORES (Cambios en Textboxes) ---------
  // IndexGrupo = En qué arreglo maestro de categoría estamos. 
  // IndexPelea = Cual pelea de la categoria.
  const handlePeleaChange = (indexGrupo, indexPelea, campo, valor) => {
     const nuevaData = [...fightFormsData];
     nuevaData[indexGrupo][indexPelea][campo] = valor;
     setFightFormsData(nuevaData);
  }

  // --------- ENVÍO FINAL Y DEFINITIVO AL GUARDAR ULTIMO PASO ---------
  const handleSubmitFINAL = async () => {
    setStatus({ type: 'loading', message: 'Subiendo toda la información al servidor maestro...' })

    try {
      // 0. SUBIR IMAGENES SI ES NECESARIO
      let finalLogoUrl = null
      let finalLogo2Url = null

      if (logoMode === 'url' && logoUrlInput.trim()) {
        finalLogoUrl = logoUrlInput.trim()
      } else if (logoMode === 'file' && logoFile) {
        setStatus({ type: 'loading', message: 'Subiendo logotipo a la Nube...' })
        // Crear nombre único para evitar colisiones
        const fileExt = logoFile.name.split('.').pop()
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `${fileName}`

        const { error: uploadError } = await supabase.storage.from('logos').upload(filePath, logoFile)
        if (uploadError) throw new Error('Error al subir la imagen al Storage. ¿Creaste el bucket "logos"?: ' + uploadError.message)

        // Obtener la URL publica generada misteriosamente por supabase
        const { data: publicUrlData } = supabase.storage.from('logos').getPublicUrl(filePath)
        finalLogoUrl = publicUrlData.publicUrl
      }

      if (logo2Mode === 'url' && logo2UrlInput.trim()) {
        finalLogo2Url = logo2UrlInput.trim()
      } else if (logo2Mode === 'file' && logo2File) {
        setStatus({ type: 'loading', message: 'Subiendo segundo logotipo a la Nube...' })
        const fileExt = logo2File.name.split('.').pop()
        const fileName = `logo2_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `${fileName}`

        const { error: uploadError } = await supabase.storage.from('logos').upload(filePath, logo2File)
        if (uploadError) throw new Error('Error al subir la segunda imagen al Storage: ' + uploadError.message)

        const { data: publicUrlData } = supabase.storage.from('logos').getPublicUrl(filePath)
        finalLogo2Url = publicUrlData.publicUrl
      }

      setStatus({ type: 'loading', message: 'Enviando maestro a base de datos...' })

      // 1. Guardar primero el Evento Base
      const payloadEvento = {
        nombre_evento: formData.nombre_evento,
        numero_evento: formData.numero_evento ? parseInt(formData.numero_evento) : null,
        disciplina: formData.disciplina,
        fecha: formData.fecha,
        ciudad: formData.ciudad,
        logo_url: finalLogoUrl, // Logo 1
        logo2_url: finalLogo2Url, // Nuevo Logo 2
        peleas_preliminares: 0, // Parche de retrocompatibilidad: Obligatorio para Supabase
        peleas_profesionales: 0 // Parche de retrocompatibilidad: Obligatorio para Supabase
      }

      const { data: dbEventos, error: errEventos } = await supabase.from('eventos').insert([payloadEvento]).select()
      if (errEventos) throw errEventos
      if (!dbEventos || dbEventos.length === 0) throw new Error("No se pudo obtener el ID del evento de Supabase.")
      
      const nuevoIdEventoGenerado = dbEventos[0].id

      // 2. Extraer TODA LA DATA de fightFormsData en un solo arreglo lineal (Flatten)
      const todasLasPeleasPayload = [];
      
      fightFormsData.forEach((grupoCategoria) => {
         grupoCategoria.forEach((pelea, indexLogico) => {
            todasLasPeleasPayload.push({
              evento_id: nuevoIdEventoGenerado,
              tipo_pelea: pelea.tipo_pelea, // "Amateur", "Kickboxing", "Profesional"
              orden: indexLogico + 1,       // 1, 2, 3 de su respectivo tipo
              rojo_nombre: pelea.rojo_nombre, rojo_apodo: pelea.rojo_apodo || null, rojo_apellido: pelea.rojo_apellido,
              azul_nombre: pelea.azul_nombre, azul_apodo: pelea.azul_apodo || null, azul_apellido: pelea.azul_apellido
            });
         });
      });

      if (todasLasPeleasPayload.length > 0) {
        const { data: dbPeleas, error: errPeleas } = await supabase.from('peleas').insert(todasLasPeleasPayload).select()
        if (errPeleas) throw errPeleas
      }

      // 3. ¡Éxito absoluto! Guardar ID para cleanup futuro y pasar a pantalla Permanente
      setSavedEventId(nuevoIdEventoGenerado)
      localStorage.setItem('pendingCleanupEventId', nuevoIdEventoGenerado.toString())
      setStatus({ type: 'success', message: '¡Cartelera Subida y Procesada!' })
      setIsSuccess(true)

    } catch (err) {
      console.error("Error Paso Final:", err)
      setStatus({ type: 'error', message: 'Error de base de datos de subida total: ' + err.message })
    }
  }


  // --------- FUNCIÓN DE LIMPIEZA DE BASE DE DATOS ---------
  const cleanupEvento = async (eventoId) => {
    if (!eventoId) return
    try {
      // 1. Obtener el evento para extraer URLs de logos
      const { data: eventoData } = await supabase.from('eventos').select('logo_url, logo2_url').eq('id', eventoId).single()

      // 2. Borrar peleas asociadas
      await supabase.from('peleas').delete().eq('evento_id', eventoId)

      // 3. Borrar el evento
      await supabase.from('eventos').delete().eq('id', eventoId)

      // 4. Borrar imágenes del Storage si fueron subidas (no URLs externas)
      if (eventoData) {
        const supabaseStorageBase = supabase.storage.from('logos')
        const urlsToDelete = [eventoData.logo_url, eventoData.logo2_url]
          .filter(url => url && url.includes('/storage/v1/object/public/logos/'))
          .map(url => url.split('/storage/v1/object/public/logos/')[1])
        if (urlsToDelete.length > 0) {
          await supabaseStorageBase.remove(urlsToDelete)
        }
      }
    } catch (err) {
      console.error('Error al limpiar evento:', err)
    }
  }

  const resetFormulario = async () => {
     // Limpiar datos de la base de datos del evento actual
     if (savedEventId) {
       await cleanupEvento(savedEventId)
       setSavedEventId(null)
       localStorage.removeItem('pendingCleanupEventId')
     }
     setIsSuccess(false)
     setIsPrintMode(false)
     setIsResultMode(false)
     setPrintDesign(1)
     setStatus({ type: '', message: '' })
     setFormData({ nombre_evento: '', numero_evento: '', disciplina: '', fecha: '2026-04-04', ciudad: '' })
     setLogoFile(null); setLogoUrlInput(''); setLogoMode('url');
     setLogo2File(null); setLogo2UrlInput(''); setLogo2Mode('url');
     setCategorias([{ id: Date.now(), tipo: '', cant: 1 }])
     setFightFormsData([])
     setCurrentStep(1)
  }

  // ==========================================
  //                RENDERS
  // ==========================================

  // --- RENDERIZADOR MAGISTRAL DINÁMICO ---
  const renderPeleasPaso = () => {
    // Calculamos qué grupo de categoría deberíamos renderizar basado en nuestro Step mágico.
    // Step 2 => Indice Grupo 0
    // Step 3 => Indice Grupo 1
    const indiceLogicoDeGrupo = currentStep - 2;
    const arrayPeleasDelPaso = fightFormsData[indiceLogicoDeGrupo];
    
    if (!arrayPeleasDelPaso) return null; // Defensive render if out of bounds

    const nombreCategoria = arrayPeleasDelPaso[0]?.tipo_pelea || 'Desconocida';
    
    // Averiguar si cerraremos final al dar Siguiente
    const isUltimoPaso = currentStep === (fightFormsData.length + 1);

    return (
      <div className="p-5 sm:p-8">
        
        {/* Cabecera Resumen parecida a la imagen enviada */}
        <div className="mb-6 p-4 sm:p-5 bg-[#f8f9fa] border border-[#e1e8f0] rounded-md">
          <p className="m-0 text-[#111] font-medium leading-relaxed">
            <span className="font-bold uppercase">{formData.nombre_evento}</span>{formData.numero_evento && `: ${formData.numero_evento}`}<br/>
            Fecha: {formData.fecha} | Ciudad: {formData.ciudad} | Disciplina: {formData.disciplina || 'Varias'}<br/>
            Actualmente llenando tarjeta: <strong className="text-[#b91d22] uppercase">{nombreCategoria} ({arrayPeleasDelPaso.length} peleas)</strong>
          </p>
        </div>

        <form onSubmit={proceedNextCategoryOrSave}>
          <div className="space-y-8">
            {arrayPeleasDelPaso.map((pelea, indexEnSuGrupo) => (
              <div key={`fight-card-${indexEnSuGrupo}`} className="bg-white border border-[#e1e8f0] rounded-md shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                
                <div className="bg-[#fcfcfc] border-b border-[#e1e8f0] px-5 py-3">
                  <h3 className="m-0 text-lg font-bold text-[#111]">
                    Pelea {nombreCategoria} #{indexEnSuGrupo + 1}
                  </h3>
                </div>

                <div className="p-5 space-y-6">
                  {/* ESQUINA ROJA */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-4 h-4 bg-[#e74c3c] rounded-sm"></div>
                      <span className="font-semibold text-[#111] uppercase tracking-wide text-sm">Esquina Roja</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-[#555] mb-1">Nombre *</label>
                        <input type="text" required
                          value={pelea.rojo_nombre}
                          onChange={(e) => handlePeleaChange(indiceLogicoDeGrupo, indexEnSuGrupo, 'rojo_nombre', e.target.value)}
                          placeholder="NOMBRE" 
                          className="w-full px-3 py-2 text-sm border border-[#e1e8f0] rounded focus:outline-none focus:ring-1 focus:ring-[#e74c3c] focus:border-[#e74c3c] bg-white transition-all uppercase"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#555] mb-1">Apellido *</label>
                        <input type="text" required
                          value={pelea.rojo_apellido}
                          onChange={(e) => handlePeleaChange(indiceLogicoDeGrupo, indexEnSuGrupo, 'rojo_apellido', e.target.value)}
                          placeholder="APELLIDO" 
                          className="w-full px-3 py-2 text-sm border border-[#e1e8f0] rounded focus:outline-none focus:ring-1 focus:ring-[#e74c3c] focus:border-[#e74c3c] bg-white transition-all uppercase"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#555] mb-1">Apodo (Opcional)</label>
                        <input type="text" 
                          value={pelea.rojo_apodo}
                          onChange={(e) => handlePeleaChange(indiceLogicoDeGrupo, indexEnSuGrupo, 'rojo_apodo', e.target.value)}
                          placeholder="APODO" 
                          className="w-full px-3 py-2 text-sm border border-[#e1e8f0] rounded focus:outline-none focus:ring-1 focus:ring-[#e74c3c] focus:border-[#e74c3c] bg-white transition-all uppercase"
                        />
                      </div>
                    </div>
                  </div>

                  <hr className="border-[#e1e8f0]"/>

                  {/* ESQUINA AZUL */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-4 h-4 bg-[#3498db] rounded-sm"></div>
                      <span className="font-semibold text-[#111] uppercase tracking-wide text-sm">Esquina Azul</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-[#555] mb-1">Nombre *</label>
                        <input type="text" required
                          value={pelea.azul_nombre}
                          onChange={(e) => handlePeleaChange(indiceLogicoDeGrupo, indexEnSuGrupo, 'azul_nombre', e.target.value)}
                          placeholder="NOMBRE" 
                          className="w-full px-3 py-2 text-sm border border-[#e1e8f0] rounded focus:outline-none focus:ring-1 focus:ring-[#3498db] focus:border-[#3498db] bg-white transition-all uppercase"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#555] mb-1">Apellido *</label>
                        <input type="text" required
                          value={pelea.azul_apellido}
                          onChange={(e) => handlePeleaChange(indiceLogicoDeGrupo, indexEnSuGrupo, 'azul_apellido', e.target.value)}
                          placeholder="APELLIDO" 
                          className="w-full px-3 py-2 text-sm border border-[#e1e8f0] rounded focus:outline-none focus:ring-1 focus:ring-[#3498db] focus:border-[#3498db] bg-white transition-all uppercase"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#555] mb-1">Apodo (Opcional)</label>
                        <input type="text" 
                          value={pelea.azul_apodo}
                          onChange={(e) => handlePeleaChange(indiceLogicoDeGrupo, indexEnSuGrupo, 'azul_apodo', e.target.value)}
                          placeholder="APODO" 
                          className="w-full px-3 py-2 text-sm border border-[#e1e8f0] rounded focus:outline-none focus:ring-1 focus:ring-[#3498db] focus:border-[#3498db] bg-white transition-all uppercase"
                        />
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-col items-center gap-3 border-t border-[#e1e8f0] pt-6">
            <button type="submit" disabled={status.type === 'loading'} className={`w-[320px] sm:w-[350px] ${isUltimoPaso ? 'bg-[#b91d22] hover:bg-[#a0181d]' : 'bg-[#3a475a] hover:bg-[#2a3442]'} disabled:opacity-50 text-white border-none py-3.5 px-6 text-[15px] font-bold rounded-md cursor-pointer transition-colors shadow-sm tracking-wide`}>
               {status.type === 'loading' ? 'SUBIENDO ESPERE...' : (isUltimoPaso ? 'VER RESUMEN FINAL' : 'CONTINUAR SIGUIENTE CATEGORÍA')}
            </button>
            <button type="button" disabled={status.type === 'loading'} onClick={handleVolverAPasoAnterior} className="w-[320px] sm:w-[350px] bg-white hover:bg-[#f8f9fa] text-[#333] border border-[#ccc] py-3 px-6 text-[14px] font-semibold rounded-md cursor-pointer transition-colors shadow-sm">
              VOLVER ATRÁS
            </button>
          </div>
        </form>

      </div>
    )
  }

  // --- RENDERIZADO PANTALLA DE RESUMEN FINAL ---
  const renderResumenFinal = () => {
     let totalPeleasAbsolutas = 0;
     fightFormsData.forEach(g => totalPeleasAbsolutas += g.length);

     return (
       <div className="p-5 sm:p-8 bg-[#fefefe]">
         
         <div className="text-center mb-8">
            <h2 className="text-2xl font-black text-[#111] uppercase tracking-wide mb-2">Revisión de tu Evento</h2>
            <p className="text-[#666] text-sm hidden sm:block">Por favor, verifica que todos los datos capturados y la cartelera sean los correctos antes de enviar la orden final a Supabase.</p>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Panel Izquierdo: General */}
            <div className="bg-[#f8f9fa] border border-[#e1e8f0] p-5 rounded-md shadow-sm">
               <h3 className="text-[13px] uppercase text-[#888] font-bold tracking-widest mb-3 flex items-center gap-2"><span className="text-lg">📋</span> Datos Generales</h3>
               <ul className="text-[15px] text-[#333] space-y-2 list-none p-0 m-0">
                  <li><strong>Nombre:</strong> {formData.nombre_evento} {formData.numero_evento ? `#${formData.numero_evento}`: ''}</li>
                  <li><strong>Disciplina:</strong> {formData.disciplina || 'Varias'}</li>
                  <li><strong>Fecha:</strong> {formData.fecha}</li>
                  <li><strong>Sede:</strong> {formData.ciudad}</li>
               </ul>
            </div>

            {/* Panel Derecho: Logos */}
            <div className="bg-[#f8f9fa] border border-[#e1e8f0] p-5 rounded-md shadow-sm">
               <h3 className="text-[13px] uppercase text-[#888] font-bold tracking-widest mb-3 flex items-center gap-2"><span className="text-lg">🖼️</span> Elementos Gráficos</h3>
               <div className="flex gap-4 items-start">
                  <div className="flex flex-col items-center gap-1">
                     <span className="text-xs font-bold text-[#555]">LOGO 1</span>
                     <div className="w-[80px] h-[80px] border border-[#ccc] bg-white rounded flex justify-center items-center overflow-hidden">
                        {(logoMode === 'url' && logoUrlInput) || (logoMode === 'file' && logoFile) ? 
                           <img src={logoMode === 'url' ? logoUrlInput : URL.createObjectURL(logoFile)} alt="L1" className="max-w-full max-h-full object-contain" /> : <span className="text-xs text-gray-400">Ninguno</span>}
                     </div>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                     <span className="text-xs font-bold text-[#555]">LOGO 2</span>
                     <div className="w-[80px] h-[80px] border border-[#ccc] bg-white rounded flex justify-center items-center overflow-hidden">
                        {(logo2Mode === 'url' && logo2UrlInput) || (logo2Mode === 'file' && logo2File) ? 
                           <img src={logo2Mode === 'url' ? logo2UrlInput : URL.createObjectURL(logo2File)} alt="L2" className="max-w-full max-h-full object-contain" /> : <span className="text-xs text-gray-400">Ninguno</span>}
                     </div>
                  </div>
               </div>
            </div>
         </div>

         {/* Panel Completo: Cartelera Extendida */}
         <div className="bg-white border text-center sm:text-left border-[#e1e8f0] rounded-md shadow-sm overflow-hidden mb-8">
            <div className="bg-[#b91d22] text-white px-5 py-3 flex justify-between items-center flex-wrap gap-2">
               <h3 className="text-sm font-bold uppercase tracking-wider m-0">🔥 Cartelera de Combates</h3>
               <span className="bg-white text-[#b91d22] text-xs font-bold px-2 py-1 rounded-sm">{totalPeleasAbsolutas} Combates en Total</span>
            </div>
            
            <div className="p-0">
               {fightFormsData.map((grupo, gIdx) => {
                  if(!grupo || grupo.length === 0) return null;
                  return (
                     <div key={`resumen-cat-${gIdx}`} className="border-b border-[#eee] last:border-0">
                        <div className="bg-[#fcfcfc] px-4 py-2 border-b border-[#eee] flex items-center justify-between">
                            <h4 className="m-0 text-[#444] text-[13px] font-bold uppercase tracking-wide">🏆 Categoría: {grupo[0].tipo_pelea}</h4>
                            <span className="text-xs font-semibold text-gray-500">{grupo.length} Peleas</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-0">
                           {grupo.map((pelea, pIdx) => (
                              <div key={`resumen-p-${gIdx}-${pIdx}`} className="p-4 border-r border-b border-[#eee] last:border-r-0 flex flex-col justify-center">
                                 <div className="text-[11px] text-gray-400 font-bold mb-2 uppercase text-center w-full">Pelea #{pIdx + 1}</div>
                                 <div className="flex items-center justify-between text-[13px]">
                                    <div className="text-right w-[45%]">
                                       <span className="block font-bold text-[#e74c3c]">{pelea.rojo_nombre} {pelea.rojo_apellido}</span>
                                       {pelea.rojo_apodo && <span className="block text-[10px] text-gray-500 uppercase">'{pelea.rojo_apodo}'</span>}
                                    </div>
                                    <div className="text-center w-[10%] text-[#ccc] font-black text-xs italic">VS</div>
                                    <div className="text-left w-[45%]">
                                       <span className="block font-bold text-[#3498db]">{pelea.azul_nombre} {pelea.azul_apellido}</span>
                                       {pelea.azul_apodo && <span className="block text-[10px] text-gray-500 uppercase">'{pelea.azul_apodo}'</span>}
                                    </div>
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>
                  )
               })}
            </div>
         </div>

         <div className="mt-10 flex flex-col items-center gap-3 border-t border-[#e1e8f0] pt-6">
            <button type="button" disabled={status.type === 'loading'} onClick={handleSubmitFINAL} className={`w-[320px] sm:w-[400px] bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white border-none py-4 px-6 text-[15px] font-black uppercase tracking-wider rounded-md cursor-pointer transition-colors shadow-md`}>
              {status.type === 'loading' ? '⏳ CONTACTANDO A SUPABASE...' : '✔️ CONFIRMAR Y PUBLICAR EVENTO'}
            </button>
            <button type="button" disabled={status.type === 'loading'} onClick={handleVolverAPasoAnterior} className="w-[320px] sm:w-[400px] bg-white hover:bg-[#f8f9fa] text-[#333] border border-[#ccc] py-3.5 px-6 text-[14px] font-semibold rounded-md cursor-pointer transition-colors shadow-sm">
              REGRESAR PARA CORREGIR ALGÚN ERROR
            </button>
         </div>

       </div>
     );
  }

  // --- RENDERIZADO TITULO TOP BAR ---
  const extractTopBarHelpText = () => {
     if(currentStep === 1) return 'Paso 1: Datos Base y Categorías';
     
     const numeroPasosTotalesConfiguradosPorUsuario = fightFormsData.length;
     
     // Pantalla final añadida (Resumen)
     if(currentStep === numeroPasosTotalesConfiguradosPorUsuario + 2) return 'Paso Final: Verificación de Datos';

     // Es step dinámico (2, 3, etc)
     const numeroIndexCategoriaLlenando = currentStep - 1; // Base 1 context para usuario
     return `Etapa Formulario de Pelea: ${numeroIndexCategoriaLlenando} de ${numeroPasosTotalesConfiguradosPorUsuario}`;
  }

  // --- INYECTOR DE IMPRESIÓN (SOBREESCRIBE INTERFAZ SI ESTÁ ACTIVO) ---
  if (isPrintMode) {
    const flattenPeleas = [];
    fightFormsData.forEach((grupoCategoria) => {
       grupoCategoria.forEach((pelea, idx) => {
           flattenPeleas.push({ ...pelea, ordenEnCategoria: idx + 1 });
       });
    });

    const totalPaginas = Math.ceil(flattenPeleas.length / 9) || 1;
    const hojasHTML = [];

    const logo1UrlFinal = logoMode === 'url' ? logoUrlInput : (logoFile ? URL.createObjectURL(logoFile) : null);
    const logo2UrlFinal = logo2Mode === 'url' ? logo2UrlInput : (logo2File ? URL.createObjectURL(logo2File) : null);
    const hasLogos = logo1UrlFinal || logo2UrlFinal;

    const formatearFecha = (fechaISO) => {
      if (!fechaISO) return '';
      const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
      const partes = fechaISO.split('-');
      if (partes.length !== 3) return fechaISO;
      const dia = parseInt(partes[2], 10);
      const mes = meses[parseInt(partes[1], 10) - 1];
      const anio = partes[0].slice(-2);
      return `${dia} ${mes} ${anio}`;
    };
    const fechaPersonalizada = formatearFecha(formData.fecha);
    for(let i = 0; i < totalPaginas; i++) {
       const peleasPagina = flattenPeleas.slice(i * 9, (i + 1) * 9);
       
       hojasHTML.push(
         <div key={`pagina-${i}`} className="hoja-impresion-carta border border-[#ccc]">
            {Array.from({length: 9}).map((_, indexCelda) => {
               const pelea = peleasPagina[indexCelda] || { tipo_pelea: '', ordenEnCategoria: '', rojo_nombre: '', rojo_apellido: '', azul_nombre: '', azul_apellido: '' };
               return (
               <div key={`celda-${i}-${indexCelda}`} className={`w-full h-full flex flex-col text-[10px] font-sans box-border relative overflow-hidden bg-white ${
                  printDesign === 3 ? 'border-[3px] border-black pt-1.5 px-1.5 pb-0 print:border-black' 
                  : 'border border-gray-400 pt-3 pb-2 px-3 print:border-[#111]'
               }`}>
                  {/* SELECTOR MÚLTIPLE DE DISEÑOS */}
                  {printDesign === 1 && (
                    <div className="w-full h-full flex flex-col">
                      {/* Cabecera Tarjeta */}
                      <div className="flex justify-between items-start mb-1.5">
                         <div className="w-[35%] flex justify-left items-center h-10 mt-0.5 gap-2 pl-0.5">
                           {hasLogos ? 
                             <>
                               {logo1UrlFinal && <img src={logo1UrlFinal} alt="Logo 1" className="max-h-full w-auto max-w-[45%] object-contain mix-blend-multiply opacity-90 scale-110 transform origin-left" />}
                               {logo2UrlFinal && <img src={logo2UrlFinal} alt="Logo 2" className="max-h-full w-auto max-w-[45%] object-contain mix-blend-multiply opacity-90 scale-110 transform origin-left" />}
                             </>
                           : 
                             <div className="bg-gray-200 text-[#555] font-black text-[8px] flex items-center justify-center p-1 px-2 uppercase text-center rounded-[2px] w-full max-w-[50px] leading-tight">Logo<br/>CRAMM</div>
                           }
                         </div>
                         <div className="w-[60%] text-right font-bold text-[8px] text-[#111] leading-tight flex flex-col items-end pt-0.5">
                           <span className="uppercase text-[9px] mb-0.5">{formData.nombre_evento} {formData.numero_evento?` ${formData.numero_evento}`:''}</span>
                           <span className="uppercase">{fechaPersonalizada}</span>
                           <span className="uppercase">{formData.ciudad}</span>
                           <span className="uppercase">{pelea.tipo_pelea} {pelea.ordenEnCategoria}</span>
                         </div>
                      </div>

                      <div className="text-center font-black text-[12px] tracking-widest mb-1.5 mt-1 uppercase text-[#111]">{`${formData.nombre_evento || 'BUDO'} ${formData.disciplina || 'STRIKING'}`.trim()}</div>

                      {/* Nombres Box Clasico */}
                      <div className="flex justify-center items-center gap-1 w-full mb-1.5 px-1">
                         <div className="w-[45%] h-[20px] bg-white border border-red-600 flex items-center relative box-border print:border-red-600 print:-webkit-print-color-adjust: exact">
                            <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-red-600 print:bg-red-600"></div>
                            <div className="pl-4 pr-1 text-center font-bold uppercase text-[9px] truncate w-full whitespace-nowrap overflow-hidden text-black">
                               {pelea.rojo_apellido || '\u00A0'}
                            </div>
                         </div>
                         <div className="w-[10%] text-center text-[7px] font-black text-black">VS</div>
                         <div className="w-[45%] h-[20px] bg-white border border-blue-600 flex items-center relative box-border print:border-blue-600 print:-webkit-print-color-adjust: exact">
                            <div className="absolute right-0 top-0 bottom-0 w-2.5 bg-blue-600 print:bg-blue-600"></div>
                            <div className="pr-4 pl-1 text-center font-bold uppercase text-[9px] truncate w-full whitespace-nowrap overflow-hidden text-black">
                               {pelea.azul_apellido || '\u00A0'}
                            </div>
                         </div>
                      </div>

                      <div className="flex-1 px-4 mt-1">
                         <div className="grid grid-cols-[1fr_30px_1fr] gap-2 items-center h-full pb-1">
                             <div className="flex flex-col gap-1.5 h-full pt-1">
                                 <div className="border border-[#111] h-[18px] w-full bg-white print:-webkit-print-color-adjust: exact"></div>
                                 <div className="border border-[#111] h-[18px] w-full bg-white print:-webkit-print-color-adjust: exact"></div>
                                 <div className="border border-[#111] h-[18px] w-full bg-white print:-webkit-print-color-adjust: exact"></div>
                                 <div className="border border-[#111] h-[18px] w-full bg-white print:-webkit-print-color-adjust: exact"></div>
                                 <div className="border border-[#111] h-[18px] w-full mt-1.5 bg-white print:-webkit-print-color-adjust: exact"></div>
                             </div>
                             <div className="flex flex-col gap-1.5 font-black text-[8px] text-black text-center h-full pt-1 justify-start">
                                 <div className="h-[18px] flex items-center justify-center">R1</div>
                                 <div className="h-[18px] flex items-center justify-center">R2</div>
                                 <div className="h-[18px] flex items-center justify-center">R3</div>
                                 <div className="h-[18px] flex items-center justify-center">R4</div>
                                 <div className="h-[18px] flex items-center justify-center mt-1.5 leading-none text-[6.5px]">TOTAL</div>
                             </div>
                             <div className="flex flex-col gap-1.5 h-full pt-1">
                                 <div className="border border-[#111] h-[18px] w-full bg-white print:-webkit-print-color-adjust: exact"></div>
                                 <div className="border border-[#111] h-[18px] w-full bg-white print:-webkit-print-color-adjust: exact"></div>
                                 <div className="border border-[#111] h-[18px] w-full bg-white print:-webkit-print-color-adjust: exact"></div>
                                 <div className="border border-[#111] h-[18px] w-full bg-white print:-webkit-print-color-adjust: exact"></div>
                                 <div className="border border-[#111] h-[18px] w-full mt-1.5 bg-white print:-webkit-print-color-adjust: exact"></div>
                             </div>
                         </div>
                      </div>

                      <div className="w-full mt-auto mb-0 flex flex-col justify-end">
                         <div className="flex justify-center gap-2 mb-6 mt-1">
                            <div className="border border-[#111] px-2 py-0.5 font-bold text-[8px] text-[#111] leading-none bg-white print:-webkit-print-color-adjust: exact">K.O</div>
                            <div className="border border-[#111] px-2 py-0.5 font-bold text-[8px] text-[#111] leading-none bg-white print:-webkit-print-color-adjust: exact">T.K.O</div>
                            <div className="border border-[#111] px-1.5 py-0.5 font-bold text-[8px] text-[#111] leading-none bg-white print:-webkit-print-color-adjust: exact">T.K.O.M</div>
                         </div>
                         <div className="font-extrabold text-[8px] text-black uppercase text-left ml-1 mt-1">NOMBRE DEL JUEZ</div>
                      </div>
                    </div>
                  )}

                  {/* DISEÑO 2: MINIMALISTA LÍNEAS */}
                  {printDesign === 2 && (
                    <div className="w-full h-full flex flex-col px-1 justify-between pb-1">
                      <div>
                        <div className="flex justify-between items-center mb-0 border-b border-gray-300 pb-1.5">
                          <div className="w-[30%] flex gap-1.5 h-7">
                             {hasLogos ? 
                               <>
                                 {logo1UrlFinal && <img src={logo1UrlFinal} alt="Logo 1" className="h-full w-auto max-w-[48%] object-contain mix-blend-multiply opacity-80" />}
                                 {logo2UrlFinal && <img src={logo2UrlFinal} alt="Logo 2" className="h-full w-auto max-w-[48%] object-contain mix-blend-multiply opacity-80" />}
                               </>
                             : 
                               <div className="font-serif italic text-gray-400 text-[10px]">CRAMM</div>
                             }
                          </div>
                          <div className="w-[70%] text-right font-light flex flex-col justify-end pt-1">
                            <div className="font-bold text-[8px] text-[#222] uppercase tracking-wider mb-0.5">{formData.nombre_evento} {formData.numero_evento?` ${formData.numero_evento}`:''}</div>
                            <div className="text-[7px] text-gray-500 tracking-widest uppercase">{fechaPersonalizada} | {formData.ciudad}</div>
                            <div className="text-[9px] text-[#333] tracking-widest uppercase mt-0.5 font-bold min-h-[14px]">
                                {pelea.tipo_pelea || pelea.ordenEnCategoria ? `${pelea.tipo_pelea} ${pelea.ordenEnCategoria}` : '\u00A0'}
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-center font-light text-[12px] tracking-[0.2em] mb-1.5 mt-1.5 uppercase text-[#222]">
                            {formData.nombre_evento} <span className="font-bold">{formData.disciplina || 'STRIKING'}</span>
                        </div>

                        <div className="w-full flex justify-between px-2 mb-1">
                           <div className="w-[45%] border-b-2 border-red-500 pb-0.5 text-center font-bold uppercase text-[9px] text-[#222] print:border-red-500 print:-webkit-print-color-adjust: exact overflow-hidden truncate min-h-[18px]">
                               {pelea.rojo_apellido || '\u00A0'}
                           </div>
                           <div className="w-[10%] text-center font-light text-[7px] text-gray-400 self-end pb-0.5">vs</div>
                           <div className="w-[45%] border-b-2 border-blue-500 pb-0.5 text-center font-bold uppercase text-[9px] text-[#222] print:border-blue-500 print:-webkit-print-color-adjust: exact overflow-hidden truncate min-h-[18px]">
                               {pelea.azul_apellido || '\u00A0'}
                           </div>
                        </div>
                      </div>

                      <div className="flex-1 px-3 mt-2 mb-1 flex flex-col justify-center">
                         <div className="grid grid-cols-[1fr_30px_1fr] gap-x-3 gap-y-2.5 items-center">
                             <div className="flex flex-col gap-2.5 justify-center">
                                 {['R1','R2','R3','R4','TOTAL'].map((r, i) => <div key={i} className={`border-b ${i===4?'border-[#000] border-b-2 mt-2':'border-gray-400'} h-[14px] w-full`}></div>)}
                             </div>
                             <div className="flex flex-col gap-2.5 font-light text-[8px] text-gray-600 text-center justify-center">
                                 {['R1','R2','R3','R4','TOTAL'].map((r, i) => <div key={i} className={`h-[14px] flex items-end justify-center ${i===4?'mt-2 font-bold text-black text-[6.5px]':''}`}>{r}</div>)}
                             </div>
                             <div className="flex flex-col gap-2.5 justify-center">
                                 {['R1','R2','R3','R4','TOTAL'].map((r, i) => <div key={i} className={`border-b ${i===4?'border-[#000] border-b-2 mt-2':'border-gray-400'} h-[14px] w-full`}></div>)}
                             </div>
                         </div>
                      </div>

                      <div className="w-full mt-auto flex flex-col items-center">
                         <div className="flex gap-4 mb-6">
                            {['K.O', 'T.K.O', 'T.K.O.M'].map((x,i) => (
                              <div key={i} className="flex items-center gap-1"><div className="w-2h-[10px] rounded-sm border border-gray-500 h-2.5 w-2.5"></div><span className="text-[7px] text-gray-600 font-bold">{x}</span></div>
                            ))}
                         </div>
                         <div className="w-full px-2 mt-1">
                            <div className="border-b border-gray-400 w-full mb-1"></div>
                            <div className="font-light text-[7px] text-gray-500 uppercase text-center tracking-widest font-bold">NOMBRE DEL JUEZ</div>
                         </div>
                      </div>
                    </div>
                  )}

                  {/* DISEÑO 3: AGRESIVO / ESTILO MMA */}
                  {printDesign === 3 && (
                    <div className="w-full h-full flex flex-col text-black print:-webkit-print-color-adjust: exact print:bg-white box-border justify-between">
                      <div>
                        <div className="flex justify-between items-center mb-1 border-b-[2px] border-black pb-1 pt-0.5">
                           <div className="w-[35%] flex justify-start items-center h-10 gap-2">
                             {hasLogos ? 
                               <>
                                 {logo1UrlFinal && <img src={logo1UrlFinal} alt="Logo 1" className="h-full w-auto max-w-[45%] object-contain object-left mix-blend-multiply opacity-100 scale-[1.10] origin-left" />}
                                 {logo2UrlFinal && <img src={logo2UrlFinal} alt="Logo 2" className="h-full w-auto max-w-[45%] object-contain object-left mix-blend-multiply opacity-100 scale-[1.10] origin-left" />}
                               </>
                             : 
                               <div className="font-black italic text-black text-[12px]">CRAMM</div>
                             }
                           </div>
                           <div className="text-right flex-1 flex flex-col items-end pt-0.5 justify-center">
                              <div className="font-black text-[8px] uppercase text-black leading-none mb-0.5">{formData.nombre_evento} {formData.numero_evento?` ${formData.numero_evento}`:''}</div>
                              <div className="font-black text-[12px] uppercase text-[#d32f2f] tracking-tighter mix-blend-multiply mb-0.5 leading-none">
                                  <span className="text-black">{formData.nombre_evento} </span>{formData.disciplina || 'STRIKING'}
                              </div>
                              <div className="text-[6px] text-black font-extrabold uppercase tracking-widest mb-0.5">
                                  {formData.ciudad} - {fechaPersonalizada}
                              </div>
                              <div className="font-bold text-[6px] text-black uppercase tracking-widest bg-yellow-400 inline-flex items-center justify-center px-1.5 pt-px print:bg-yellow-400 print:-webkit-print-color-adjust: exact border border-black shadow-[1px_1px_0px_#000] h-[11px] min-w-[40px]">
                                  {pelea.tipo_pelea || pelea.ordenEnCategoria ? `${pelea.tipo_pelea} ${pelea.ordenEnCategoria}` : '\u00A0'}
                              </div>
                           </div>
                        </div>

                        <div className="flex w-full mt-1.5 justify-center gap-1.5">
                           <div className="w-[45%] bg-[#d32f2f] text-white px-0.5 py-1 text-center font-black uppercase text-[9px] tracking-wider truncate print:bg-[#d32f2f] print:-webkit-print-color-adjust: exact border-[2px] border-black print:border-black shadow-[1.5px_1.5px_0px_#000] min-h-[22px]">
                             {pelea.rojo_apellido || '\u00A0'}
                           </div>
                           <div className="w-[10%] text-center text-[8px] font-black text-black self-center italic leading-none pt-0.5">VS</div>
                           <div className="w-[45%] bg-[#1976d2] text-white px-0.5 py-1 text-center font-black uppercase text-[9px] tracking-wider truncate print:bg-[#1976d2] print:-webkit-print-color-adjust: exact border-[2px] border-black print:border-black shadow-[1.5px_1.5px_0px_#000] min-h-[22px]">
                             {pelea.azul_apellido || '\u00A0'}
                           </div>
                        </div>
                      </div>

                      <div className="flex-1 mt-2 flex flex-col justify-center">
                         <div className="grid grid-cols-[1fr_26px_1fr] gap-y-2 gap-x-2 items-center">
                             <div className="flex flex-col gap-2">
                                 {[1,2,3,4,5].map((_,i) => <div key={i} className={`border-[2px] border-black bg-white h-[16px] w-full print:-webkit-print-color-adjust: exact print:border-black ${i===4?'mt-1 shadow-[2px_2px_0px_#000]':''}`}></div>)}
                             </div>
                             <div className="flex flex-col gap-2 font-black text-[9px] text-black text-center print:text-black print:-webkit-print-color-adjust: exact mt-0.5">
                                 {['R1','R2','R3','R4'].map((r,i) => <div key={i} className="h-[16px] bg-black text-white flex items-center justify-center print:bg-black print:text-white print:-webkit-print-color-adjust: exact rounded-sm">{r}</div>)}
                                 <div className="h-[16px] bg-black text-white flex items-center justify-center print:bg-black print:text-white print:-webkit-print-color-adjust: exact rounded-sm mt-1 px-px">
                                     <span className="text-[5.5px] tracking-wide leading-none pt-px">TOTAL</span>
                                 </div>
                             </div>
                             <div className="flex flex-col gap-2">
                                 {[1,2,3,4,5].map((_,i) => <div key={i} className={`border-[2px] border-black bg-white h-[16px] w-full print:-webkit-print-color-adjust: exact print:border-black ${i===4?'mt-1 shadow-[2px_2px_0px_#000]':''}`}></div>)}
                             </div>
                         </div>
                      </div>

                      <div className="w-[calc(100%+12px)] mt-auto mx-[-6px] flex flex-col px-3 border-t-[2px] border-black pt-2 pb-1.5 bg-gray-50 print:bg-gray-50 print:-webkit-print-color-adjust: exact">
                         <div className="flex gap-2 w-full justify-center mb-6">
                            {['K.O', 'T.K.O', 'T.K.O.M'].map((x,i) => (
                              <div key={i} className="bg-white border-2 border-black px-1.5 py-0.5 font-black text-[7px] text-black shadow-[1.5px_1.5px_0px_#000] print:-webkit-print-color-adjust: exact">{x}</div>
                            ))}
                         </div>
                         <div className="w-full flex justify-between items-end px-1 mt-0.5">
                            <div className="font-extrabold text-[7px] text-black uppercase">NOMBRE DEL JUEZ</div>
                            <div className="border-b-[2px] border-black w-28 border-solid"></div>
                         </div>
                      </div>
                    </div>
                  )}
               </div>
            )})}
         </div>
       )
    }

    return (
      <div className="impresion-preview-wrapper bg-gray-500 font-sans min-h-screen print:bg-white print:min-h-0 print:p-0">
         <div className="no-print fixed top-0 left-0 right-0 bg-gray-800 text-white flex flex-col z-50 shadow-md">
            <div className="flex justify-between items-center p-3 border-b border-gray-700">
               <div>
                 <h2 className="m-0 text-md font-bold ml-2">Vista Previa de Impresión</h2>
                 <p className="text-xs text-gray-400 ml-2 mt-0.5 text-ellipsis max-w-[400px] whitespace-nowrap overflow-hidden">
                   Escoge el diseño deseado. Asegúrate de desactivar "Márgenes" en el menú de impresión y activar "Gráficos de Fondo".
                 </p>
               </div>
               <div className="flex gap-3 shrink-0">
                  <button onClick={() => setIsPrintMode(false)} className="bg-gray-600 hover:bg-gray-500 px-5 py-2 rounded text-sm font-bold text-white transition-colors cursor-pointer border-none">Volver</button>
                  <button onClick={() => window.print()} className="bg-[#b91d22] hover:bg-[#a0181d] px-6 py-2 rounded text-sm font-bold text-white transition-colors shadow-lg cursor-pointer border-none flex items-center gap-2">🖨️ IMPRIMIR AHORA</button>
               </div>
            </div>
            
            {/* Opciones de Plantilla */}
            <div className="bg-gray-900 py-2.5 px-5 flex justify-center items-center gap-6 shadow-inner">
               <span className="font-bold text-xs text-gray-400 uppercase tracking-widest">Modelo de Hoja:</span>
               
               <label className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors group">
                 <input type="radio" value={1} checked={printDesign === 1} onChange={() => setPrintDesign(1)} className="w-4 h-4 accent-red-500 cursor-pointer" />
                 <span className={`text-sm font-semibold transition-colors ${printDesign === 1 ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>1. Clásico</span>
               </label>

               <label className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors group">
                 <input type="radio" value={2} checked={printDesign === 2} onChange={() => setPrintDesign(2)} className="w-4 h-4 accent-red-500 cursor-pointer" />
                 <span className={`text-sm font-semibold transition-colors ${printDesign === 2 ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>2. Premium Minimalista</span>
               </label>
               
               <label className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors group">
                 <input type="radio" value={3} checked={printDesign === 3} onChange={() => setPrintDesign(3)} className="w-4 h-4 accent-red-500 cursor-pointer" />
                 <span className={`text-sm font-semibold transition-colors ${printDesign === 3 ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>3. Agresivo Oscuro</span>
               </label>
            </div>
         </div>
         <div className="pt-32 pb-10 print:p-0 print:m-0">
            {hojasHTML}
         </div>
      </div>
    )
   }

   if (isResultMode) {
     const flattenPeleas = [];
     fightFormsData.forEach((grupoCategoria) => {
        grupoCategoria.forEach((pelea) => {
            flattenPeleas.push(pelea);
        });
     });

     const totalPaginas = Math.ceil(flattenPeleas.length / 2) || 1;
     const hojasHTML = [];

     for(let i = 0; i < totalPaginas; i++) {
        const peleasPagina = flattenPeleas.slice(i * 2, (i + 1) * 2);
        // Rellenar con nulls si solo hay 1 pelea en la página
        while(peleasPagina.length < 2) peleasPagina.push(null);
        
        hojasHTML.push(
          <div key={`pagina-res-${i}`} className="hoja-resultado-carta">
             {peleasPagina.map((pelea, idx) => (
                <div key={`result-card-${i}-${idx}`} style={{flex: '1', border: '4px solid black', padding: '20px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', background: 'white', position: 'relative'}}>
                   {pelea ? (
                     <>
                       {/* TÍTULO */}
                       <div style={{textAlign: 'center', marginBottom: '12px'}}>
                          <div style={{fontSize: '20px', fontWeight: '900', textTransform: 'uppercase', textDecoration: 'underline', letterSpacing: '0.2em', lineHeight: '1.2'}}>TARJETA DE RESULTADO</div>
                          <div style={{fontSize: '16px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.3em', marginTop: '4px'}}>"VENCEDOR"</div>
                       </div>

                       {/* TIEMPO Y ROUND */}
                       <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '14px', padding: '0 20px', alignItems: 'flex-end'}}>
                          <div style={{display: 'flex', alignItems: 'flex-end', gap: '8px'}}>
                             <span style={{fontWeight: '900', fontSize: '13px', whiteSpace: 'nowrap'}}>TIEMPO:</span>
                             <div style={{display: 'flex', gap: '8px', borderBottom: '2px solid black', paddingBottom: '2px', minWidth: '140px', justifyContent: 'center', fontSize: '10px', color: '#888'}}>
                                <span>min</span>
                                <span style={{color: 'black'}}>/</span>
                                <span>seg</span>
                             </div>
                          </div>
                          <div style={{display: 'flex', alignItems: 'flex-end', gap: '8px'}}>
                             <span style={{fontWeight: '900', fontSize: '13px', whiteSpace: 'nowrap'}}>ROUND:</span>
                             <div style={{borderBottom: '2px solid black', width: '100px', height: '20px'}}></div>
                          </div>
                       </div>

                       {/* COLUMNAS PRINCIPALES */}
                       <div style={{display: 'flex', flex: '1', position: 'relative', borderTop: '2px solid black', paddingTop: '16px'}}>
                          {/* LÍNEA DIVISORIA CENTRAL */}
                          <div style={{position: 'absolute', left: '50%', top: '0', bottom: '0', width: '3px', background: 'black', transform: 'translateX(-50%)'}}></div>

                          {/* COLUMNA IZQUIERDA - ESQUINA ROJA */}
                          <div style={{flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingRight: '30px', gap: '10px'}}>
                             <div style={{fontWeight: '900', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center'}}>K.O.</div>
                             <div style={{fontWeight: '900', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center'}}>Decisión Unánime</div>
                             
                             <div style={{width: '100%', border: '3px solid #e74c3c', padding: '12px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', marginTop: '10px'}}>
                                <span style={{color: '#e74c3c', fontWeight: '900', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.15em', display: 'block', marginBottom: '8px', borderBottom: '1px solid #fca5a5', paddingBottom: '4px', width: '100%'}}>Esquina Roja</span>
                                <div style={{fontWeight: '900', fontSize: '15px', textTransform: 'uppercase', lineHeight: '1.4', color: 'black'}}>
                                   {pelea.rojo_nombre}{' '}
                                   {pelea.rojo_apodo ? <em>"{pelea.rojo_apodo}"</em> : null}{' '}
                                   {pelea.rojo_apellido}
                                </div>
                             </div>
                          </div>

                          {/* COLUMNA DERECHA - ESQUINA AZUL */}
                          <div style={{flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingLeft: '30px', gap: '10px'}}>
                             <div style={{fontWeight: '900', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center'}}>K.O. Técnico (T.K.O)</div>
                             <div style={{fontWeight: '900', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center'}}>Decisión Dividida</div>

                             <div style={{width: '100%', border: '3px solid #3498db', padding: '12px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', marginTop: '10px'}}>
                                <span style={{color: '#3498db', fontWeight: '900', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.15em', display: 'block', marginBottom: '8px', borderBottom: '1px solid #93c5fd', paddingBottom: '4px', width: '100%'}}>Esquina Azul</span>
                                <div style={{fontWeight: '900', fontSize: '15px', textTransform: 'uppercase', lineHeight: '1.4', color: 'black'}}>
                                   {pelea.azul_nombre}{' '}
                                   {pelea.azul_apodo ? <em>"{pelea.azul_apodo}"</em> : null}{' '}
                                   {pelea.azul_apellido}
                                </div>
                             </div>
                          </div>
                       </div>
                     </>
                   ) : (
                     <div style={{flex: '1'}}></div>
                   )}
                </div>
             ))}
          </div>
        );
     }

     return (
       <div className="resultado-wrapper" style={{background: '#1a1a1a', minHeight: '100vh'}}>
          <div className="no-print" style={{position: 'fixed', top: 0, left: 0, right: 0, background: '#222', color: 'white', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 50, borderBottom: '1px solid black', boxShadow: '0 4px 12px rgba(0,0,0,0.4)'}}>
             <button onClick={() => setIsResultMode(false)} style={{background: '#444', border: 'none', color: 'white', padding: '8px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '13px'}}>
                ← Regresar
             </button>
             <h2 style={{margin: 0, fontSize: '18px', fontWeight: '900', letterSpacing: '0.1em', color: '#ef4444', textTransform: 'uppercase'}}>Tarjetas de Resultado</h2>
             <button onClick={() => window.print()} style={{background: '#dc2626', border: 'none', color: 'white', padding: '8px 32px', borderRadius: '6px', fontWeight: '900', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '13px', boxShadow: '0 4px 0 #991b1b'}}>
                🖨️ Imprimir Ahora
             </button>
          </div>
          <div className="resultado-content" style={{paddingTop: '100px', paddingBottom: '40px'}}>
             {hojasHTML}
          </div>
       </div>
     )
   }

   // --- RENDER PRINCIPAL APP ---
  return (
    <div className="flex justify-center items-start min-h-screen pt-10 pb-10 bg-[#eef1f5] no-print">
      <div className={`w-full bg-white rounded-lg shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden font-sans transition-all duration-300 ${currentStep === 1 ? 'max-w-[700px]' : 'max-w-[850px]'}`}>
        
        <div className={currentStep === 1 ? "bg-[#b91d22] text-white text-center py-6 px-5" : "bg-[#6c7b95] text-white text-center py-5 px-5"}>
          <h1 className="m-0 text-[26px] font-bold tracking-wide">Generador de Tarjetas</h1>
          <p className="mt-2 text-sm opacity-90 font-medium tracking-wide shadow-sm">
            {extractTopBarHelpText()}
          </p>
        </div>
        
        {status.message && (
          <div className={`p-4 text-center text-sm font-bold text-white shadow-inner ${
            status.type === 'success' ? 'bg-green-500' :
            status.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
          }`}>
            {status.message}
          </div>
        )}
        {/* PANTALLA EXCLUSIVA DE ÉXITO PERMANENTE */}
        {isSuccess && (
           <div className="p-10 text-center py-16 bg-white flex flex-col items-center">
              <div className="w-20 h-20 bg-[#f0f9f3] text-green-600 rounded-full flex items-center justify-center mb-6 text-3xl font-black border border-green-200">✓</div>
              <h2 className="text-2xl font-black text-[#111] mb-2 uppercase">¡Registro Terminado!</h2>
              <p className="text-gray-500 mb-10 max-w-sm">La base de datos fue actualizada. Ahora puedes imprimir las Cartas de Jueces para este evento organizado.</p>
              
              <div className="flex flex-col gap-4 items-center w-full max-w-[350px]">
                 <button type="button" onClick={() => setIsPrintMode(true)} className="w-full bg-[#3a475a] hover:bg-[#2a3442] border-none text-white py-4 font-bold rounded-md uppercase tracking-wider text-[13px] transition-colors shadow-sm cursor-pointer">
                    🖨️ Generar y previsualizar Tarjetas de Jueces
                 </button>
                 <button type="button" onClick={() => setIsResultMode(true)} className="w-full bg-[#b91d22] hover:bg-[#96181b] border-none text-white py-4 font-bold rounded-md uppercase tracking-wider text-[13px] transition-colors shadow-[0_4px_0_rgb(130,20,24)] active:translate-y-1 active:shadow-none cursor-pointer">
                    🏆 Generar Tarjetas de Resultados
                 </button>
                 <button type="button" onClick={resetFormulario} className="w-full bg-white border border-[#ccc] hover:bg-gray-50 text-[#333] py-4 font-bold rounded-md uppercase tracking-wider text-[13px] transition-colors cursor-pointer">
                    ✚ Capturar un Evento Nuevo
                 </button>
              </div>
           </div>
        )}
        {/* STEP 1: FORMULARIO DEL EVENTO Y SU GENERADOR DE CATEGORIAS */}
        {!isSuccess && currentStep === 1 && (
          <form className="p-8 sm:p-8 sm:px-10" onSubmit={proceedFromStep1}>
            
            {/* COMPACTAMOS EVENTO Y CIUDAD ARRIBA */}
            <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
               
               <div>
                  <label className="block text-sm font-semibold text-[#111] mb-2">Nombre del Evento *</label>
                  {isAddingNombre ? (
                     <div className="flex items-center gap-1">
                        <input type="text" value={nuevoNombreInput} onChange={(e) => setNuevoNombreInput(e.target.value)} placeholder="Ej. Budo Strike..." className="flex-grow p-2.5 text-sm border border-[#e1e8f0] rounded focus:outline-none" autoFocus />
                        <button type="button" onClick={handleSaveNuevoNombre} className="bg-green-600 text-white p-2.5 text-sm rounded">✓</button>
                        <button type="button" onClick={() => { setIsAddingNombre(false); setNuevoNombreInput(''); }} className="bg-gray-500 text-white p-2.5 text-sm rounded">✗</button>
                     </div>
                  ) : isDeletingNombre ? (
                     <div className="flex flex-col bg-white border border-red-400 rounded-md max-h-40 relative">
                        <div className="bg-red-50 p-2 border-b border-red-200 flex justify-between items-center text-xs text-red-700 font-bold"><span>Hacer clic para borrar:</span> <button type="button" onClick={() => setIsDeletingNombre(false)}>X</button> </div>
                        <div className="overflow-y-auto w-full">
                           {nombresEventos.map((n) => (<button key={n.id} type="button" onClick={() => executeDeleteNombre(n.nombre)} className="w-full text-left p-2 hover:bg-red-100 border-b border-gray-100 last:border-0 cursor-pointer text-sm">❌ {n.nombre}</button>))}
                        </div>
                     </div>
                  ) : (
                     <div className="flex gap-1 h-[42px]">
                        <select name="nombre_evento" value={formData.nombre_evento} onChange={handleChange1} className="flex-grow p-2.5 text-sm border border-[#e1e8f0] rounded bg-white text-[#333] cursor-pointer" required>
                           <option value="" disabled hidden>Seleccione evento</option>
                           {nombresEventos.map((n) => (<option key={n.id} value={n.nombre}>{n.nombre}</option>))}
                        </select>
                        <button type="button" onClick={() => { setIsAddingNombre(true); setIsDeletingNombre(false); }} className="w-[42px] bg-white border border-[#e1e8f0] rounded text-[#333] flex justify-center items-center text-lg hover:bg-gray-50">+</button>
                        <button type="button" onClick={() => setIsDeletingNombre(true)} className="w-[42px] bg-white border border-[#e1e8f0] rounded text-red-500 flex justify-center items-center text-lg hover:bg-red-50">🗑️</button>
                     </div>
                  )}
               </div>

               <div>
                 <label className="block text-sm font-semibold text-[#111] mb-2">Ciudad Base *</label>
                  {isAddingCiudad ? (
                     <div className="flex items-center gap-1">
                        <input type="text" value={nuevaCiudadInput} onChange={(e) => setNuevaCiudadInput(e.target.value)} placeholder="Agrega Ciudad HQ" className="flex-grow p-2.5 text-sm border border-[#e1e8f0] rounded focus:outline-none" autoFocus />
                        <button type="button" onClick={handleSaveNuevaCiudad} className="bg-green-600 text-white p-2.5 text-sm rounded">✓</button>
                        <button type="button" onClick={() => { setIsAddingCiudad(false); setNuevaCiudadInput(''); }} className="bg-gray-500 text-white p-2.5 text-sm rounded">✗</button>
                     </div>
                  ) : isDeletingCiudad ? (
                     <div className="flex flex-col bg-white border border-red-400 rounded-md max-h-40 relative">
                        <div className="bg-red-50 p-2 border-b border-red-200 flex justify-between items-center text-xs text-red-700 font-bold"><span>Hacer clic para borrar:</span> <button type="button" onClick={() => setIsDeletingCiudad(false)}>X</button> </div>
                        <div className="overflow-y-auto w-full">
                           {ciudades.map((c) => (<button key={c.id} type="button" onClick={() => executeDeleteCiudad(c.nombre)} className="w-full text-left p-2 hover:bg-red-100 border-b border-gray-100 last:border-0 cursor-pointer text-sm">❌ {c.nombre}</button>))}
                        </div>
                     </div>
                  ) : (
                     <div className="flex gap-1 h-[42px]">
                        <select name="ciudad" value={formData.ciudad} onChange={handleChange1} className="flex-grow p-2.5 text-sm border border-[#e1e8f0] rounded bg-white text-[#333] cursor-pointer" required>
                           <option value="" disabled hidden>Seleccione ciudad</option>
                           {ciudades.map((c) => (<option key={c.id} value={c.nombre}>{c.nombre}</option>))}
                        </select>
                        <button type="button" onClick={() => { setIsAddingCiudad(true); setIsDeletingCiudad(false); }} className="w-[42px] bg-white border border-[#e1e8f0] rounded text-[#333] flex justify-center items-center text-lg hover:bg-gray-50">+</button>
                        <button type="button" onClick={() => setIsDeletingCiudad(true)} className="w-[42px] bg-white border border-[#e1e8f0] rounded text-red-500 flex justify-center items-center text-lg hover:bg-red-50">🗑️</button>
                     </div>
                  )}
               </div>

            </div>

             <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div>
                   <label className="block text-sm font-semibold text-[#111] mb-2">Número Evento (Id)</label>
                   <input name="numero_evento" value={formData.numero_evento} onChange={handleChange1} type="number" placeholder="Ej. 12" className="w-full p-2.5 text-sm border border-[#e1e8f0] rounded bg-white" min="0" />
                </div>
                <div>
                   <label className="block text-sm font-semibold text-[#111] mb-2">Disciplina *</label>
                   <input name="disciplina" value={formData.disciplina} onChange={handleChange1} type="text" placeholder="Ej. Box, MMA, Karate" className="w-full p-2.5 text-sm border border-[#e1e8f0] rounded bg-white" required />
                </div>
                <div>
                   <label className="block text-sm font-semibold text-[#111] mb-2">Fecha del Torneo *</label>
                   <input name="fecha" value={formData.fecha} onChange={handleChange1} type="date" className="w-full p-2.5 text-sm border border-[#e1e8f0] rounded bg-white cursor-pointer" required />
                </div>
             </div>

             <hr className="my-8 border-[#e1e8f0]"/>

             {/* ZONA DE CARGA DE LOGO DE EVENTO HIBRIDA */}
             <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
               
               {/* Logo 1 */}
               <div className="bg-[#f8f9fa] p-4 rounded border border-[#eee]">
                 <label className="block text-sm font-semibold text-[#111] mb-2">Logo Principal / Cartel (Opcional)</label>
                 <div className="flex gap-4 mb-3 border-b border-[#e1e8f0]">
                    <button type="button" onClick={() => setLogoMode('url')} className={`px-2 py-2 text-xs font-semibold cursor-pointer ${logoMode === 'url' ? 'border-b-2 border-[#b91d22] text-[#111]' : 'text-gray-500 hover:text-gray-800'}`}>Pegar URL</button>
                    <button type="button" onClick={() => setLogoMode('file')} className={`px-2 py-2 text-xs font-semibold cursor-pointer ${logoMode === 'file' ? 'border-b-2 border-[#b91d22] text-[#111]' : 'text-gray-500 hover:text-gray-800'}`}>Subir Archivo</button>
                 </div>
                 
                 {logoMode === 'url' ? (
                    <input type="url" value={logoUrlInput} onChange={(e) => setLogoUrlInput(e.target.value)} placeholder="https://ejemplo.com/mifoto.png" className="w-full p-2.5 text-xs border border-[#e1e8f0] rounded bg-white" />
                 ) : (
                    <input type="file" accept="image/*" onChange={(e) => { if(e.target.files && e.target.files.length>0) setLogoFile(e.target.files[0]) }} className="w-full p-2.5 text-xs border border-[#e1e8f0] rounded bg-white file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#eef1f5] file:text-[#333] hover:file:bg-[#e2e6ea]" />
                 )}

                 {((logoMode === 'url' && logoUrlInput) || (logoMode === 'file' && logoFile)) && (
                   <div className="mt-3 w-full h-[150px] border border-[#e1e8f0] rounded-md flex justify-center items-center overflow-hidden bg-white shadow-sm p-2">
                      <img src={logoMode === 'url' ? logoUrlInput : URL.createObjectURL(logoFile)} alt="Logo Preview" className="max-w-full max-h-full object-contain" onError={(e) => e.target.style.display = 'none'} />
                   </div>
                 )}
               </div>

               {/* Logo 2 */}
               <div className="bg-[#f8f9fa] p-4 rounded border border-[#eee]">
                 <label className="block text-sm font-semibold text-[#111] mb-2">Logo Secundario (Opcional)</label>
                 <div className="flex gap-4 mb-3 border-b border-[#e1e8f0]">
                    <button type="button" onClick={() => setLogo2Mode('url')} className={`px-2 py-2 text-xs font-semibold cursor-pointer ${logo2Mode === 'url' ? 'border-b-2 border-[#b91d22] text-[#111]' : 'text-gray-500 hover:text-gray-800'}`}>Pegar URL</button>
                    <button type="button" onClick={() => setLogo2Mode('file')} className={`px-2 py-2 text-xs font-semibold cursor-pointer ${logo2Mode === 'file' ? 'border-b-2 border-[#b91d22] text-[#111]' : 'text-gray-500 hover:text-gray-800'}`}>Subir Archivo</button>
                 </div>
                 
                 {logo2Mode === 'url' ? (
                    <input type="url" value={logo2UrlInput} onChange={(e) => setLogo2UrlInput(e.target.value)} placeholder="https://ejemplo.com/mifoto2.png" className="w-full p-2.5 text-xs border border-[#e1e8f0] rounded bg-white" />
                 ) : (
                    <input type="file" accept="image/*" onChange={(e) => { if(e.target.files && e.target.files.length>0) setLogo2File(e.target.files[0]) }} className="w-full p-2.5 text-xs border border-[#e1e8f0] rounded bg-white file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#eef1f5] file:text-[#333] hover:file:bg-[#e2e6ea]" />
                 )}

                 {((logo2Mode === 'url' && logo2UrlInput) || (logo2Mode === 'file' && logo2File)) && (
                   <div className="mt-3 w-full h-[150px] border border-[#e1e8f0] rounded-md flex justify-center items-center overflow-hidden bg-white shadow-sm p-2">
                      <img src={logo2Mode === 'url' ? logo2UrlInput : URL.createObjectURL(logo2File)} alt="Logo Preview" className="max-w-full max-h-full object-contain" onError={(e) => e.target.style.display = 'none'} />
                   </div>
                 )}
               </div>

             </div>
             
             <hr className="my-8 border-[#e1e8f0]"/>

            {/* ZONA DE CATEGORIAS DE PELEA (NUEVA ARQUITECTURA DINAMICA) */}
            <div className="mb-6">
               <div className="mb-4">
                  <h3 className="text-lg font-bold text-[#b91d22] m-0 flex items-center gap-2">
                     <span className="bg-[#b91d22] text-white w-6 h-6 rounded-full flex justify-center items-center text-[12px] shadow-sm">🥊</span> 
                     Estructura y Tipos de Peleas
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">Crea bloques de combates. Escribe el Tipo (ej. <i>Amateur 60kg</i>, <i>Profesional</i>) e ingresa cuántas peleas son.</p>
               </div>
               
               <div className="space-y-3 bg-[#f8f9fa] p-4 rounded-md border border-[#eee]">
                  {categorias.map((cat, idx) => (
                     <div key={cat.id} className="flex grid grid-cols-[1fr_80px_auto] items-center gap-3">
                        <input type="text" placeholder="Categoría (Ej. Preliminar)" value={cat.tipo} onChange={(e)=>updateCategoria(idx, 'tipo', e.target.value)} className="w-full p-2.5 text-sm border border-[#ccc] rounded focus:border-[#888] outline-none" required />
                        <input type="number" placeholder="Cant." min="1" max="40" value={cat.cant} onChange={(e)=>updateCategoria(idx, 'cant', e.target.value)} className="w-full p-2.5 text-sm border border-[#ccc] rounded text-center focus:border-[#888] outline-none" required title="Cantidad de peleas de este tipo" />
                        
                        {/* Botón borrar fila solo si hay más de 1 categoría */}
                        {categorias.length > 1 ? (
                           <button type="button" onClick={() => removeCategoria(idx)} className="w-[38px] h-[38px] text-red-500 border border-red-200 hover:bg-red-50 rounded bg-white flex justify-center items-center text-lg" title="Quitar Categoría">X</button>
                        ) : (
                           <div className="w-[38px]"></div> // Spacer visual 
                        )}
                     </div>
                  ))}
                  
                  <button type="button" onClick={agregarCategoria} className="mt-2 text-sm text-[#3a475a] font-bold hover:underline flex items-center gap-1 pt-2">
                     + Añadir otro Nuevo Tipo de Pelea
                  </button>
               </div>
            </div>

            <div className="mt-10 text-center">
              <button type="submit" className="w-[250px] bg-[#3a475a] hover:bg-[#2a3442] text-white border-none py-3.5 px-6 text-sm font-semibold rounded-md cursor-pointer tracking-wide transition-colors shadow-sm">
                INICIAR REGISTRO
              </button>
            </div>
          </form>
        )}

        {/* MÚLTIPLES PASOS DINÁMICOS DE PELEADORES PREDIBUJADOS */}
        {!isSuccess && currentStep > 1 && currentStep <= fightFormsData.length + 1 && renderPeleasPaso()}

        {/* PASO EXCLUSIVO: RESUMEN GENERAL PRE-GUARDADO */}
        {!isSuccess && currentStep === fightFormsData.length + 2 && renderResumenFinal()}
        
      </div>
    </div>
  )
}

export default App
