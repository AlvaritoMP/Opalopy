import { supabase } from '../supabase';
import { APP_NAME } from '../appConfig';
import {
    TARGET_APP,
    SNAPSHOT_VERSION,
    buildWorkerSnapshot,
    getWorkerDisplayName,
    validateSnapshotForSend,
    ACTIVE_PACKAGE_STATUSES,
} from '../workerHandoffFields';
import type {
    Candidate,
    Process,
    WorkerHandoffItem,
    WorkerHandoffPackage,
    WorkerHandoffPackageStatus,
    WorkerSnapshot,
    CandidateHandoffHistoryEntry,
    WorkerHandoffDeliveryStatus,
} from '../types';

export interface SendWorkerHandoffInput {
    candidates: Candidate[];
    processes: Process[];
    senderNote?: string;
    createdBy?: string;
    createdByName?: string;
    /** Claves de campos a incluir en el snapshot (ver WORKER_HANDOFF_FIELD_GROUPS). */
    includedFields?: string[];
}

const DELIVER_FUNCTION_NAME = 'deliver-worker-handoff';

function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
    if (!error) return false;
    return error.code === '42703' || (error.message?.includes('column') ?? false);
}

function mapPackage(row: Record<string, unknown>): WorkerHandoffPackage {
    return {
        id: row.id as string,
        sourceApp: row.source_app as string,
        targetApp: row.target_app as string,
        status: row.status as WorkerHandoffPackageStatus,
        workerCount: row.worker_count as number,
        senderNote: (row.sender_note as string) || undefined,
        createdBy: (row.created_by as string) || undefined,
        createdByName: (row.created_by_name as string) || undefined,
        sentAt: row.sent_at as string,
        receivedAt: (row.received_at as string) || undefined,
        completedAt: (row.completed_at as string) || undefined,
        receiverNote: (row.receiver_note as string) || undefined,
        payloadVersion: row.payload_version as number,
        deliveryStatus: (row.delivery_status as WorkerHandoffPackage['deliveryStatus']) || undefined,
        opsflowPackageId: (row.opsflow_package_id as string) || undefined,
        deliveryError: (row.delivery_error as string) || undefined,
        deliveredAt: (row.delivered_at as string) || undefined,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
    };
}

function mapItem(row: Record<string, unknown>): WorkerHandoffItem {
    return {
        id: row.id as string,
        packageId: row.package_id as string,
        sourceCandidateId: (row.source_candidate_id as string) || '',
        sourceProcessId: (row.source_process_id as string) || undefined,
        workerName: row.worker_name as string,
        workerSnapshot: row.worker_snapshot as WorkerSnapshot,
        itemStatus: row.item_status as WorkerHandoffItem['itemStatus'],
        createdAt: row.created_at as string,
    };
}

async function deliverToOpsflow(packageId: string): Promise<WorkerHandoffPackage> {
    const { data, error } = await supabase.functions.invoke(DELIVER_FUNCTION_NAME, {
        body: { packageId },
    });

    if (error) {
        throw new Error(
            error.message ||
                'No se pudo entregar el paquete a OpsFlow. Verifica que la Edge Function deliver-worker-handoff esté desplegada.'
        );
    }

    const result = data as { error?: string; details?: string; success?: boolean } | null;
    if (result?.error) {
        throw new Error(result.details || result.error);
    }

    const { data: pkg, error: pkgError } = await supabase
        .from('worker_handoff_packages')
        .select('*')
        .eq('id', packageId)
        .eq('source_app', APP_NAME)
        .maybeSingle();

    if (pkgError) throw pkgError;
    if (!pkg) {
        throw new Error('Paquete enviado pero no se pudo recargar el historial.');
    }

    const { data: items, error: itemsError } = await supabase
        .from('worker_handoff_items')
        .select('*')
        .eq('package_id', packageId)
        .order('created_at', { ascending: true });

    if (itemsError) throw itemsError;

    return {
        ...mapPackage(pkg as Record<string, unknown>),
        items: (items || []).map(row => mapItem(row as Record<string, unknown>)),
    };
}

export const workerHandoffApi = {
    async listPackages(limit = 100): Promise<WorkerHandoffPackage[]> {
        const { data, error } = await supabase
            .from('worker_handoff_packages')
            .select('*')
            .eq('source_app', APP_NAME)
            .order('sent_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return (data || []).map(row => mapPackage(row as Record<string, unknown>));
    },

    async getPackageWithItems(packageId: string): Promise<WorkerHandoffPackage | null> {
        const { data: pkg, error: pkgError } = await supabase
            .from('worker_handoff_packages')
            .select('*')
            .eq('id', packageId)
            .eq('source_app', APP_NAME)
            .maybeSingle();

        if (pkgError) throw pkgError;
        if (!pkg) return null;

        const { data: items, error: itemsError } = await supabase
            .from('worker_handoff_items')
            .select('*')
            .eq('package_id', packageId)
            .order('created_at', { ascending: true });

        if (itemsError) throw itemsError;

        return {
            ...mapPackage(pkg as Record<string, unknown>),
            items: (items || []).map(row => mapItem(row as Record<string, unknown>)),
        };
    },

    async getCandidateHandoffHistory(candidateId: string): Promise<CandidateHandoffHistoryEntry[]> {
        const { data, error } = await supabase
            .from('worker_handoff_items')
            .select(`
                id,
                package_id,
                created_at,
                worker_handoff_packages!inner (
                    id,
                    sent_at,
                    sender_note,
                    created_by_name,
                    delivery_status,
                    delivery_error,
                    opsflow_package_id,
                    source_app
                )
            `)
            .eq('source_candidate_id', candidateId)
            .eq('worker_handoff_packages.source_app', APP_NAME)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return (data || []).map(row => {
            const pkg = row.worker_handoff_packages as Record<string, unknown>;
            return {
                itemId: row.id as string,
                packageId: row.package_id as string,
                sentAt: (pkg.sent_at as string) || (row.created_at as string),
                deliveryStatus: (pkg.delivery_status as WorkerHandoffDeliveryStatus) || undefined,
                createdByName: (pkg.created_by_name as string) || undefined,
                senderNote: (pkg.sender_note as string) || undefined,
                opsflowPackageId: (pkg.opsflow_package_id as string) || undefined,
                deliveryError: (pkg.delivery_error as string) || undefined,
            };
        });
    },

    async getActiveCandidateIds(candidateIds: string[]): Promise<string[]> {
        if (candidateIds.length === 0) return [];

        let { data: activePackages, error: packagesError } = await supabase
            .from('worker_handoff_packages')
            .select('id')
            .eq('source_app', APP_NAME)
            .in('status', [...ACTIVE_PACKAGE_STATUSES])
            .in('delivery_status', ['pending', 'delivered']);

        if (packagesError && isMissingColumnError(packagesError)) {
            const fallback = await supabase
                .from('worker_handoff_packages')
                .select('id')
                .eq('source_app', APP_NAME)
                .in('status', [...ACTIVE_PACKAGE_STATUSES]);
            activePackages = fallback.data;
            packagesError = fallback.error;
        }

        if (packagesError) throw packagesError;

        const packageIds = (activePackages || []).map(row => row.id as string);
        if (packageIds.length === 0) return [];

        const { data, error } = await supabase
            .from('worker_handoff_items')
            .select('source_candidate_id')
            .in('package_id', packageIds)
            .in('source_candidate_id', candidateIds);

        if (error) throw error;

        const activeIds = new Set<string>();
        for (const row of data || []) {
            const candidateId = row.source_candidate_id as string | null;
            if (candidateId) activeIds.add(candidateId);
        }
        return [...activeIds];
    },

    async retryDelivery(packageId: string): Promise<WorkerHandoffPackage> {
        const now = new Date().toISOString();
        const { error: resetError } = await supabase
            .from('worker_handoff_packages')
            .update({
                delivery_status: 'pending',
                delivery_error: null,
                updated_at: now,
            })
            .eq('id', packageId)
            .eq('source_app', APP_NAME);

        if (resetError && !isMissingColumnError(resetError)) {
            throw resetError;
        }

        return deliverToOpsflow(packageId);
    },

    async sendPackage(input: SendWorkerHandoffInput): Promise<WorkerHandoffPackage> {
        const { candidates, processes, senderNote, createdBy, createdByName, includedFields } = input;

        if (candidates.length === 0) {
            throw new Error('Selecciona al menos un candidato para enviar.');
        }

        const processById = new Map(processes.map(process => [process.id, process]));
        const preparedItems: Array<{
            sourceCandidateId: string;
            sourceProcessId: string;
            workerName: string;
            workerSnapshot: WorkerSnapshot;
        }> = [];

        for (const candidate of candidates) {
            const process = processById.get(candidate.processId);
            const snapshot = buildWorkerSnapshot(candidate, process, { includedFields });
            const validationError = validateSnapshotForSend(snapshot);
            if (validationError) {
                throw new Error(`${candidate.name || 'Candidato'}: ${validationError}`);
            }
            preparedItems.push({
                sourceCandidateId: candidate.id,
                sourceProcessId: candidate.processId,
                workerName: getWorkerDisplayName(snapshot),
                workerSnapshot: snapshot,
            });
        }

        const sentAt = new Date().toISOString();
        const trimmedNote = senderNote?.trim() || null;

        const insertPayload: Record<string, unknown> = {
            source_app: APP_NAME,
            target_app: TARGET_APP,
            status: 'sent',
            worker_count: preparedItems.length,
            sender_note: trimmedNote,
            created_by: createdBy || null,
            created_by_name: createdByName || null,
            sent_at: sentAt,
            payload_version: SNAPSHOT_VERSION,
            updated_at: sentAt,
            delivery_status: 'pending',
        };

        let { data: pkg, error: pkgError } = await supabase
            .from('worker_handoff_packages')
            .insert(insertPayload)
            .select('*')
            .single();

        if (pkgError && isMissingColumnError(pkgError)) {
            delete insertPayload.delivery_status;
            const retry = await supabase
                .from('worker_handoff_packages')
                .insert(insertPayload)
                .select('*')
                .single();
            pkg = retry.data;
            pkgError = retry.error;
        }

        if (pkgError) throw pkgError;

        const packageId = (pkg as Record<string, unknown>).id as string;

        const { error: itemsError } = await supabase
            .from('worker_handoff_items')
            .insert(
                preparedItems.map(item => ({
                    package_id: packageId,
                    source_candidate_id: item.sourceCandidateId,
                    source_process_id: item.sourceProcessId,
                    worker_name: item.workerName,
                    worker_snapshot: item.workerSnapshot,
                    item_status: 'pending',
                }))
            );

        if (itemsError) {
            await supabase.from('worker_handoff_packages').delete().eq('id', packageId);
            throw itemsError;
        }

        try {
            return await deliverToOpsflow(packageId);
        } catch (deliveryError) {
            const message =
                deliveryError instanceof Error
                    ? deliveryError.message
                    : 'Error al entregar a OpsFlow';
            const failedUpdate: Record<string, unknown> = {
                delivery_status: 'failed',
                delivery_error: message.slice(0, 1000),
                updated_at: new Date().toISOString(),
            };
            await supabase
                .from('worker_handoff_packages')
                .update(failedUpdate)
                .eq('id', packageId);
            throw new Error(
                `${message} El paquete quedó registrado; puedes reintentar desde Envíos OpsFlow.`
            );
        }
    },
};
