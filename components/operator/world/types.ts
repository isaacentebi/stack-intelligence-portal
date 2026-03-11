export type WorldModelSummary = {
  knowledge_revision: string;
  taxonomy_version?: string;
  totals: {
    layer_count: number;
    node_count: number;
    company_count: number;
    company_node_count: number;
    pending_review_count: number;
  };
  layers: Array<{
    layer_id: number;
    name: string;
    description: string;
    node_count: number;
    nodes: Array<{
      node_id: string;
      name: string;
      description: string;
      company_count: number;
      pending_review_count: number;
    }>;
  }>;
};

export type WorldModelNode = {
  knowledge_revision: string;
  node: {
    node_id: string;
    name: string;
    description: string;
    layer_id: number;
    layer_name: string;
    version?: number;
    updated_at?: string | null;
    scope?: {
      includes?: string[];
      excludes?: string[];
    };
    adjacency?: {
      upstream?: Array<{
        node_id: string;
        relationship?: string;
        description?: string;
      }>;
      downstream?: Array<{
        node_id: string;
        relationship?: string;
        description?: string;
      }>;
    };
    signals?: Array<{
      signal_id?: string;
      name: string;
      type?: string;
      source?: string;
    }>;
    bottleneck_profile?: {
      is_bottleneck?: boolean;
      bottleneck_type?: string;
      concentration?: string;
      lead_time?: string;
      substitutability?: string;
      notes?: string;
    };
    moat_profile?: {
      primary_moat_types?: string[];
      moat_durability?: string;
      notes?: string;
    };
    pending_review_count: number;
    company_count: number;
    companies: Array<{
      ticker: string;
      name: string;
      role?: string;
      relevance?: string;
      moat_in_node?: string[];
      revenue_exposure?: string;
      accepted_at?: string | null;
      pending_review_count: number;
    }>;
  };
};

export type CompanyRoutePayload = {
  company: string;
  appearances: Array<{
    layerId: number;
    layerName: string;
    nodeId: string;
    nodeTitle: string;
  }>;
  nodeCount: number;
};

export type ReviewQueueResponse = {
  generated_at: string | null;
  summary: {
    queue_count?: number;
  };
  items: Array<{
    proposal_key: string;
    entity_type: string;
    subject_key: string;
    subject_label: string;
    review_reason: string;
    priority?: string;
    retained_node_ids?: string[];
    challenged_node_ids?: string[];
    proposed_node_ids?: string[];
  }>;
};

export type BottlenecksResponse = {
  summary: {
    active_count: number;
  };
  items: Array<{
    node_id: string;
    status?: string;
    severity?: string;
    confidence?: string;
    assessed_at?: string | null;
    notes?: string;
    watch_tickers?: string[];
  }>;
};

export type RoutingLedgerResponse = {
  summary: {
    entry_count: number;
  };
  items: Array<{
    entry_id?: string;
    node_id?: string | null;
    decision?: string;
    priority?: string;
    status?: string;
    trigger?: string;
    created_at?: string | null;
    accepted_at?: string | null;
    notes?: string;
    nodes?: Array<{
      node_id: string;
      node_name?: string;
      layer_id?: number;
      layer_name?: string;
    }>;
  }>;
};
